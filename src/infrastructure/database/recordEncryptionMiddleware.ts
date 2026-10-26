import type {
  DBCore,
  DBCoreCursor,
  DBCoreTable,
  Middleware,
} from "dexie";
import {
  decryptFields,
  encryptFields,
  hasRecordKey,
  type EncryptedFields,
} from "../../security/recordEncryption";

/**
 * Transparent field-level encryption for vault tables.
 *
 * Fields listed here stay in plaintext because they are primary keys or are
 * used in indexed queries (where(...)); every other field is encrypted into
 * `__enc`. Adding an index on a field means adding it here first.
 */
export const PLAINTEXT_FIELDS: ReadonlyMap<string, ReadonlySet<string>> = new Map([
  ["documents", new Set(["id", "ownerId", "createdAt", "updatedAt"])],
  ["products", new Set(["id", "ownerId", "createdAt", "updatedAt"])],
  ["coverages", new Set(["id", "ownerId", "productId", "createdAt", "updatedAt"])],
  ["reminders", new Set(["id", "ownerId", "relatedEntityType", "relatedEntityId", "createdAt", "updatedAt"])],
  ["profiles", new Set(["id", "createdAt", "updatedAt"])],
  ["finance", new Set(["id", "ownerId", "createdAt", "updatedAt"])],
  ["vehicles", new Set(["id", "ownerId", "createdAt", "updatedAt"])],
  ["properties", new Set(["id", "ownerId", "createdAt", "updatedAt"])],
  ["secrets", new Set(["id", "ownerId", "createdAt", "updatedAt"])],
  ["medicalRecords", new Set(["id", "ownerId", "createdAt", "updatedAt"])],
  // Attachment blobs are already AES-GCM encrypted with the vault key.
  ["attachments", new Set(["id", "ownerId", "documentId", "storageType", "storageKey", "blob", "iv", "encryptionVersion", "size", "createdAt"])],
]);

export const ENCRYPTED_TABLES = [...PLAINTEXT_FIELDS.keys()];

/** Marks rows read back in legacy plaintext form, so they can be migrated. */
export const LEGACY_PLAINTEXT = Symbol("mld.legacyPlaintext");

export function isLegacyPlaintextRow(row: unknown): boolean {
  return typeof row === "object" && row !== null && LEGACY_PLAINTEXT in row;
}

type Row = Record<string, unknown> & { __enc?: EncryptedFields };

function isRow(value: unknown): value is Row {
  return typeof value === "object" && value !== null;
}

/** Own fields except the ciphertext; "__proto__" can be an own key in parsed backup JSON and is never copied. */
function ownFields(value: Row): [string, unknown][] {
  return Object.entries(value).filter(([field]) => field !== "__enc" && field !== "__proto__");
}

function encryptRow(tableName: string, plaintextFields: ReadonlySet<string>, value: unknown): unknown {
  if (!isRow(value)) return value;

  if (!hasRecordKey()) {
    // Vault locked or not created yet (e.g. profile created during onboarding):
    // store as-is. Plaintext rows are encrypted on the next unlock, and rows
    // still carrying __enc keep their ciphertext.
    return value;
  }

  const fields = ownFields(value).filter(([, fieldValue]) => fieldValue !== undefined);
  const stored = Object.fromEntries(fields.filter(([field]) => plaintextFields.has(field)));
  let secret = Object.fromEntries(fields.filter(([field]) => !plaintextFields.has(field)));

  // A row read while locked still carries its ciphertext and lacks the
  // secret fields: keep them instead of overwriting with an empty record.
  if (value.__enc) {
    secret = { ...decryptFields(tableName, value.id, value.__enc), ...secret };
  }

  return { ...stored, __enc: encryptFields(tableName, value.id, secret) };
}

function decryptRow(tableName: string, value: unknown): unknown {
  if (!isRow(value)) return value;

  const enc = value.__enc;
  if (!enc) {
    // Non-enumerable, so the marker never reaches app code that copies or serializes the row.
    Object.defineProperty(value, LEGACY_PLAINTEXT, { value: true, configurable: true });
    return value;
  }

  if (!hasRecordKey()) {
    // Locked: expose only the plaintext fields (and keep the ciphertext so an
    // accidental write-back cannot erase the encrypted fields).
    return { ...value };
  }

  return { ...decryptFields(tableName, value.id, enc), ...Object.fromEntries(ownFields(value)) };
}

function wrapCursor(tableName: string, cursor: DBCoreCursor): DBCoreCursor {
  let lastRaw: unknown;
  let lastDecrypted: unknown;
  return Object.create(cursor, {
    value: {
      get() {
        const raw = cursor.value;
        if (raw !== lastRaw) {
          lastRaw = raw;
          lastDecrypted = decryptRow(tableName, raw);
        }
        return lastDecrypted;
      },
    },
  });
}

function encryptingTable(table: DBCoreTable, plaintextFields: ReadonlySet<string>): DBCoreTable {
  const tableName = table.name;
  return {
    ...table,
    mutate(req) {
      if (req.type === "add" || req.type === "put") {
        return table.mutate({
          ...req,
          values: req.values.map((v) => encryptRow(tableName, plaintextFields, v)),
        });
      }
      return table.mutate(req);
    },
    get(req) {
      return table.get(req).then((v) => decryptRow(tableName, v));
    },
    getMany(req) {
      return table.getMany(req).then((values) => values.map((v) => decryptRow(tableName, v)));
    },
    query(req) {
      return table.query(req).then((res) =>
        req.values ? { ...res, result: res.result.map((v) => decryptRow(tableName, v)) } : res,
      );
    },
    openCursor(req) {
      return table.openCursor(req).then((cursor) =>
        cursor && req.values !== false ? wrapCursor(tableName, cursor) : cursor,
      );
    },
  };
}

export const recordEncryptionMiddleware: Middleware<DBCore> = {
  stack: "dbcore",
  name: "MyLifeDockRecordEncryption",
  // Directly above Dexie's lowest built-in layer, below observability and the
  // liveQuery cache (level 0), so everything above sees plaintext records.
  level: -0.5,
  create(down) {
    return {
      ...down,
      table(tableName) {
        const table = down.table(tableName);
        const plaintextFields = PLAINTEXT_FIELDS.get(tableName);
        return plaintextFields ? encryptingTable(table, plaintextFields) : table;
      },
    };
  },
};

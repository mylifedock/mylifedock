import Dexie, {
  type EntityTable,
} from "dexie";

export type SensitivityLevel =
  | "normal"
  | "sensitive"
  | "critical";

export type StoragePolicy =
  | "local-only"
  | "drive-allowed"
  | "sync-allowed";

export type DocumentCategory =
  | "identity"
  | "certificate"
  | "education"
  | "employment"
  | "tax"
  | "travel"
  | "insurance"
  | "financial"
  | "property"
  | "vehicle"
  | "product"
  | "membership"
  | "other";

export interface DocumentRecord {
  id: string;
  ownerId: string;
  title: string;
  category: DocumentCategory;
  documentType?: string;
  issuer?: string;
  issueDate?: string;
  expiryDate?: string;
  sensitivity: SensitivityLevel;
  storagePolicy: StoragePolicy;
  attachmentId?: string;
  tags: string[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AttachmentRecord {
  id: string;
  ownerId: string;
  documentId: string;
  fileName: string;
  mimeType: string;
  size: number;
  storageType:
    | "indexeddb"
    | "google-drive";
  storageKey: string;
  blob?: Blob;

  /*
   * Attachment encryption metadata.
   *
   * encryptionVersion === 1 means the blob is
   * encrypted using AES-256-GCM with the vault key.
   */
  iv?: ArrayBuffer;
  encryptionVersion?: number;

  createdAt: string;
}

export interface ProductRecord {
  id: string;
  ownerId: string;
  category: string;
  name: string;
  brand?: string;
  model?: string;
  serialNumber?: string;
  imei?: string;
  purchaseDate?: string;
  purchasePrice?: number;
  vendor?: string;
  invoiceDocumentId?: string;
  sensitivity: SensitivityLevel;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export type CoverageType =
  | "warranty"
  | "extended-warranty"
  | "amc"
  | "insurance"
  | "membership";

export interface CoverageRecord {
  id: string;
  ownerId: string;
  productId?: string; // Optional: Health/Life insurance might not tie to a physical product
  type: CoverageType;
  provider?: string;
  policyNumber?: string;
  startDate: string;
  endDate: string;
  documentId?: string;
  reminderEnabled: boolean;
  reminderDaysBefore: number;
  createdAt: string;
  updatedAt: string;
}

export interface ReminderRecord {
  id: string;
  ownerId: string;
  title: string;
  dueDate: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProfileRecord {
  id: string;
  displayName: string;
  createdAt: string;
  updatedAt: string;
}

export interface FinanceRecord {
  id: string;
  ownerId: string;
  category: "bank" | "card" | "investment" | "liability";
  institution: string;
  accountType?: string;
  identifier?: string; // Last 4 digits ONLY (enforced by UI)
  balance?: number;
  currency?: string;
  issueDate?: string;
  expiryDate?: string;
  notes?: string;
  documentId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface VehicleRecord {
  id: string;
  ownerId: string;
  make: string;
  model: string;
  year?: number;
  registrationNumber?: string;
  vin?: string;
  purchaseDate?: string;
  purchasePrice?: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PropertyRecord {
  id: string;
  ownerId: string;
  type: "house" | "land" | "rental" | "commercial" | "other";
  address: string;
  purchaseDate?: string;
  purchasePrice?: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export type SecretCategory = "password" | "pin" | "crypto" | "combination" | "note";

export interface SecretRecord {
  id: string;
  ownerId: string;
  title: string;
  category: SecretCategory;
  value: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Security metadata for the local vault.
 *
 * IMPORTANT:
 * - User passphrases are NEVER stored.
 * - The actual vault encryption key is NEVER stored in plaintext.
 * - The vault key is protected by independent wrapping mechanisms.
 *
 * Current recovery architecture:
 *
 * 1. wrappedVaultKey
 *    → passphrase-derived AES-KW key
 *
 * 2. wrappedRecoveryVaultKey
 *    → random recovery-key AES-KW key
 *
 * Future:
 *
 * 3. wrappedTrustedDeviceVaultKey
 *    → trusted-device credential/key
 *
 * 4. wrappedAccountVaultKey
 *    → authenticated account/device credential
 */
export interface VaultSecurityRecord {
  id: string;

  keyVersion: number;

  kdf: "PBKDF2";
  kdfHash: "SHA-256";
  kdfIterations: number;

  salt: ArrayBuffer;

  wrappedVaultKey: ArrayBuffer;

  recoveryVersion?: number;
  wrappedRecoveryVaultKey?: ArrayBuffer;

  trustedDeviceVersion?: number;
  wrappedTrustedDeviceVaultKey?: ArrayBuffer;

  accountVersion?: number;
  wrappedAccountVaultKey?: ArrayBuffer;

  createdAt: string;
  updatedAt: string;
}

export class MyLifeDockDatabase
  extends Dexie
{
  documents!: EntityTable<
    DocumentRecord,
    "id"
  >;

  attachments!: EntityTable<
    AttachmentRecord,
    "id"
  >;

  products!: EntityTable<
    ProductRecord,
    "id"
  >;

  coverages!: EntityTable<
    CoverageRecord,
    "id"
  >;

  reminders!: EntityTable<
    ReminderRecord,
    "id"
  >;

  profiles!: EntityTable<
    ProfileRecord,
    "id"
  >;

  vaultSecurity!: EntityTable<
    VaultSecurityRecord,
    "id"
  >;

  finance!: EntityTable<
    FinanceRecord,
    "id"
  >;

  vehicles!: EntityTable<
    VehicleRecord,
    "id"
  >;

  properties!: EntityTable<
    PropertyRecord,
    "id"
  >;

  secrets!: EntityTable<
    SecretRecord,
    "id"
  >;

  constructor() {
    super("MyLifeDock");

    this.version(1).stores({
      documents:
        "id, ownerId, category, expiryDate, sensitivity, storagePolicy, *tags",

      attachments:
        "id, ownerId, documentId, storageType, createdAt",

      products:
        "id, ownerId, category, brand, serialNumber, imei, purchaseDate",

      coverages:
        "id, ownerId, productId, type, startDate, endDate",

      reminders:
        "id, ownerId, dueDate, enabled, relatedEntityType, relatedEntityId",

      profiles:
        "id",
    });

    // Version 2 adds the vault security metadata table.
    //
    // Existing version-1 data remains untouched.
    this.version(2).stores({
      vaultSecurity: "id",
    });

    this.version(3).stores({
      finance: "id, ownerId, category",
      vehicles: "id, ownerId",
      properties: "id, ownerId, type",
    });

    this.version(4).stores({
      secrets: "id, ownerId, category",
    });
  }
}

export const db =
  new MyLifeDockDatabase();
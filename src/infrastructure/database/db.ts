import Dexie, {
  type EntityTable,
} from "dexie";
import { recordEncryptionMiddleware } from "./recordEncryptionMiddleware";

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

export type InsurancePolicyKind = "health" | "life" | "vehicle" | "home" | "travel" | "device" | "other";

export interface CoverageRecord {
  id: string;
  ownerId: string;
  productId?: string; // Optional: Health/Life insurance might not tie to a physical product
  /** Insurance only: the vehicle or property the policy covers. */
  vehicleId?: string;
  propertyId?: string;
  /** Insurance only: what kind of policy it is. */
  policyKind?: InsurancePolicyKind;
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

export type ProfileRole = "primary" | "dependent_child" | "dependent_elder" | "spouse";

export interface ProfileRecord {
  id: string;
  displayName: string;
  role?: ProfileRole;
  avatarIcon?: string; // an emoji, e.g. "👶"; shown through ui/profileAvatar.ts
  birthDate?: string;
  bloodGroup?: string;
  allergies?: string;
  pediatricianOrDoctor?: string;
  emergencyNotes?: string;
  /** Emergency Kit for this person; encrypted with the rest of the profile. */
  emergencyKit?: EmergencyKitData;
  /** Recurring bills (local profile only); encrypted with the rest of the profile. */
  subscriptions?: SubscriptionData[];
  createdAt: string;
  updatedAt: string;
}

export interface SubscriptionData {
  id: string;
  name: string;
  category: "entertainment" | "utilities" | "software" | "health" | "finance" | "other";
  amount: number;
  currency: string;
  billingCycle: "monthly" | "yearly" | "quarterly";
  nextBillingDate: string;
  paymentMethod?: string;
  autoRenew: boolean;
  notes?: string;
}

/**
 * Emergency Kit fields kept on each person's profile. Blood group, allergies,
 * doctor and notes live on the profile itself (one place for health details).
 */
export interface EmergencyKitData {
  fullName: string;
  medications: string;
  organDonor: boolean;
  emergencyContactName: string;
  emergencyContactPhone: string;
  emergencyContactRelation: string;
  doctorPhone: string;
  willLocation: string;
  /** Older builds stored these in the kit; they are read once and moved to the profile. */
  bloodGroup?: string;
  allergies?: string;
  doctorName?: string;
  notes?: string;
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

export type MedicalRecordType = "prescription" | "lab_report";

export interface MedicalRecord {
  id: string;
  ownerId: string;
  type: MedicalRecordType;
  title: string;
  date: string;
  department: string;
  doctorOrClinic?: string;
  diagnosis?: string;
  medicationsOrSummary?: string;
  followUpDate?: string;
  attachmentIds?: string[];
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

  /*
   * Record (field-level) encryption key, AES-GCM wrapped by the vault key.
   * See src/security/recordEncryption.ts.
   */
  wrappedRecordKey?: ArrayBuffer;
  recordKeyIv?: ArrayBuffer;

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

  medicalRecords!: EntityTable<
    MedicalRecord,
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

    this.version(5).stores({
      finance: "id, ownerId, category, createdAt",
      vehicles: "id, ownerId, createdAt",
      properties: "id, ownerId, type, createdAt",
      secrets: "id, ownerId, category, createdAt",
    });

    this.version(6).stores({
      medicalRecords: "id, ownerId, type, department, date, createdAt",
    });

    // Version 7 drops indexes on sensitive fields (never queried) so those
    // fields can be encrypted at rest by recordEncryptionMiddleware. Only
    // id-like fields and timestamps remain indexed and in plaintext.
    this.version(7).stores({
      documents: "id, ownerId",
      products: "id, ownerId",
      coverages: "id, ownerId, productId",
      reminders: "id, ownerId, relatedEntityType, relatedEntityId",
      finance: "id, ownerId, createdAt",
      properties: "id, ownerId, createdAt",
      secrets: "id, ownerId, createdAt",
      medicalRecords: "id, ownerId, createdAt",
    });

    this.use(recordEncryptionMiddleware);
  }
}

export const db =
  new MyLifeDockDatabase();
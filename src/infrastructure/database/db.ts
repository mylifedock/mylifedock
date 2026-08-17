import Dexie, { type EntityTable } from "dexie";

export type SensitivityLevel = "normal" | "sensitive" | "critical";

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

  storageType: "indexeddb" | "google-drive";

  storageKey: string;

  blob?: Blob;

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
  | "insurance";

export interface CoverageRecord {
  id: string;
  ownerId: string;
  productId: string;
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

export class MyLifeDockDatabase extends Dexie {
  documents!: EntityTable<DocumentRecord, "id">;
  attachments!: EntityTable<AttachmentRecord, "id">;
  products!: EntityTable<ProductRecord, "id">;
  coverages!: EntityTable<CoverageRecord, "id">;
  reminders!: EntityTable<ReminderRecord, "id">;
  profiles!: EntityTable<ProfileRecord, "id">;

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
      profiles: "id",
    });
  }
}

export interface ProfileRecord {
  id: string;
  displayName: string;
  createdAt: string;
  updatedAt: string;
}

export const db = new MyLifeDockDatabase();
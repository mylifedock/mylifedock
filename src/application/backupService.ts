import { Filesystem, Directory } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import { Capacitor } from "@capacitor/core";
import { db } from "../infrastructure/database/db";
import { getUnlockedVaultKey } from "../security/vaultKeyService";
import { isTauri, showSaveDialog, writeFileDesktop } from "../platform/desktopBridge";

export interface VaultBackup {
  version: number;
  timestamp: string;
  data: Record<string, unknown[]>;
}

export async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      const base64 = result.includes(",") ? result.split(",")[1] : result;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export async function createBackupBlob(): Promise<{ blob: Blob; filename: string }> {
  const vaultKey = getUnlockedVaultKey();
  if (!vaultKey) throw new Error("Vault is locked");

  const exportData: Record<string, unknown[]> = {
    documents: await db.documents.toArray(),
    products: await db.products.toArray(),
    coverages: await db.coverages.toArray(),
    reminders: await db.reminders.toArray(),
    finance: await db.finance.toArray(),
    vehicles: await db.vehicles.toArray(),
    properties: await db.properties.toArray(),
    secrets: await db.secrets.toArray(),
  };

  const attachments = await db.attachments.toArray();
  exportData["attachments"] = attachments.map(a => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { blob, ...metadata } = a;
    return metadata;
  });

  const backupPayload: VaultBackup = {
    version: 1,
    timestamp: new Date().toISOString(),
    data: exportData,
  };

  const jsonString = JSON.stringify(backupPayload);
  const encoder = new TextEncoder();
  const plaintext = encoder.encode(jsonString);

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    vaultKey,
    plaintext
  );

  const blob = new Blob([iv, ciphertext], { type: "application/octet-stream" });
  const filename = `MyLifeDock_Backup_${new Date().toISOString().split("T")[0]}.mldv`;
  
  return { blob, filename };
}

export async function exportVault(): Promise<void> {
  const { blob, filename } = await createBackupBlob();

  if (Capacitor.isNativePlatform()) {
    const base64Data = await blobToBase64(blob);
    
    // Save to Cache directory
    const savedFile = await Filesystem.writeFile({
      path: filename,
      data: base64Data,
      directory: Directory.Cache,
    });

    // Invoke native Android/iOS system Share/Save sheet
    await Share.share({
      title: "MyLifeDock Vault Backup",
      text: "Encrypted MyLifeDock Backup File (.mldv)",
      url: savedFile.uri,
      dialogTitle: "Save or Share Vault Backup",
    });
  } else if (isTauri()) {
    const arrayBuffer = await blob.arrayBuffer();
    const filePath = await showSaveDialog({
      defaultPath: filename,
      filters: [{ name: "MyLifeDock Vault Backup (*.mldv)", extensions: ["mldv"] }],
    });
    if (filePath) {
      await writeFileDesktop(filePath, new Uint8Array(arrayBuffer));
    }
  } else {
    // Web fallback
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}

export async function importVault(file: File | Blob): Promise<void> {
  const vaultKey = getUnlockedVaultKey();
  if (!vaultKey) throw new Error("Vault is locked");

  const arrayBuffer = await file.arrayBuffer();
  if (arrayBuffer.byteLength < 12) throw new Error("Invalid backup file: Too small");

  const iv = new Uint8Array(arrayBuffer.slice(0, 12));
  const ciphertext = arrayBuffer.slice(12);

  let plaintext: ArrayBuffer;
  try {
    plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      vaultKey,
      ciphertext
    );
  } catch (err) {
    throw new Error("Decryption failed. Ensure your vault password matches the one used to create this backup.", { cause: err });
  }

  const decoder = new TextDecoder();
  const jsonString = decoder.decode(plaintext);
  let backupPayload: VaultBackup;
  
  try {
    backupPayload = JSON.parse(jsonString);
  } catch (err) {
    throw new Error("Backup file is corrupted or not valid JSON.", { cause: err });
  }

  if (!backupPayload.version || !backupPayload.data) {
    throw new Error("Unrecognized backup format.");
  }

  const tables = ["documents", "products", "coverages", "reminders", "finance", "vehicles", "properties", "secrets", "attachments"] as const;
  
  // Create an array of Dexie tables for the transaction
  const dexieTables = tables.map(t => db.table(t));

  await db.transaction('rw', dexieTables, async () => {
    for (const table of tables) {
      if (Object.prototype.hasOwnProperty.call(backupPayload.data, table)) {
        const tableData = backupPayload.data[table as keyof typeof backupPayload.data];
        if (Array.isArray(tableData)) {
          const targetTable = db.table(table);
          await targetTable.clear();
          await targetTable.bulkAdd(tableData);
        }
      }
    }
  });
}

import { test, expect, type Page } from '@playwright/test';

// Verifies field-level encryption at rest by reading IndexedDB directly
// (bypassing Dexie and its decrypting middleware).

const PASS = 'RecordPassword1234';

async function setup(page: Page) {
  await page.goto('/');
  await page.evaluate(() => {
    const w = window as unknown as Record<string, unknown>;
    w.__load = (p: string) => import(/* @vite-ignore */ p);
    w.__rawRows = (store: string) =>
      new Promise((resolve, reject) => {
        const open = indexedDB.open('MyLifeDock');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const idb = open.result;
          const req = idb.transaction(store, 'readonly').objectStore(store).getAll();
          req.onsuccess = () => { idb.close(); resolve(req.result); };
          req.onerror = () => { idb.close(); reject(req.error); };
        };
      });
    w.__rawPut = (store: string, value: unknown) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('MyLifeDock');
        open.onsuccess = () => {
          const idb = open.result;
          const tx = idb.transaction(store, 'readwrite');
          tx.objectStore(store).put(value);
          tx.oncomplete = () => { idb.close(); resolve(); };
          tx.onerror = () => { idb.close(); reject(tx.error); };
        };
        open.onerror = () => reject(open.error);
      });
  });
}

// Dynamically imported app modules and raw IndexedDB rows are untyped here.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Loose = any;
type W = { __load: (p: string) => Promise<Loose>; __rawRows: (s: string) => Promise<Loose[]>; __rawPut: (s: string, v: unknown) => Promise<void> };

test.describe('Record encryption at rest', () => {
  test.beforeEach(async ({ page }) => setup(page));

  test('Sensitive fields are stored only as ciphertext and read back decrypted', async ({ page }) => {
    const result = await page.evaluate(async (pass) => {
      const w = window as unknown as W;
      const vault = await w.__load('/src/security/vaultKeyService.ts');
      const { db } = await w.__load('/src/infrastructure/database/db.ts');
      await vault.initializeVault(pass);

      await db.medicalRecords.add({
        id: 'med-1', ownerId: 'local-profile', type: 'prescription', title: 'Cardiology review',
        date: '2026-10-01', department: 'Cardiology', diagnosis: 'SECRET-DIAGNOSIS-XYZ',
        medicationsOrSummary: 'SECRET-MEDICATION-ABC', createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z',
      });
      await db.products.add({
        id: 'prod-1', ownerId: 'local-profile', category: 'phone', name: 'Phone', serialNumber: 'SN-SECRET-123',
        imei: '356938035643809', sensitivity: 'sensitive', createdAt: '', updatedAt: '',
      });

      const rawMed = (await w.__rawRows('medicalRecords'))[0];
      const rawProduct = (await w.__rawRows('products'))[0];
      const decrypted = await db.medicalRecords.get('med-1');
      const viaQuery = await db.products.where('ownerId').equals('local-profile').toArray();
      return {
        rawKeys: Object.keys(rawMed).sort(),
        rawText: JSON.stringify(rawMed) + JSON.stringify(rawProduct),
        hasCiphertext: rawMed.__enc instanceof Uint8Array || rawMed.__enc?.ct instanceof Uint8Array,
        diagnosis: decrypted?.diagnosis,
        department: decrypted?.department,
        serial: viaQuery[0]?.serialNumber,
        decryptedHasEnc: decrypted && '__enc' in decrypted,
      };
    }, PASS);

    expect(result.rawKeys).toEqual(['__enc', 'createdAt', 'id', 'ownerId', 'updatedAt']);
    expect(result.hasCiphertext).toBe(true);
    for (const secret of ['SECRET-DIAGNOSIS-XYZ', 'SECRET-MEDICATION-ABC', 'Cardiology', 'SN-SECRET-123', '356938035643809']) {
      expect(result.rawText).not.toContain(secret);
    }
    expect(result.diagnosis).toBe('SECRET-DIAGNOSIS-XYZ');
    expect(result.department).toBe('Cardiology');
    expect(result.serial).toBe('SN-SECRET-123');
    expect(result.decryptedHasEnc).toBe(false);
  });

  test('Onboarding profile (created before the vault) is encrypted once the vault exists', async ({ page }) => {
    const result = await page.evaluate(async (pass) => {
      const w = window as unknown as W;
      const profiles = await w.__load('/src/application/profileService.ts');
      const vault = await w.__load('/src/security/vaultKeyService.ts');
      await profiles.createLocalProfile('Priya Secretname');
      const before = JSON.stringify(await w.__rawRows('profiles'));
      await vault.initializeVault(pass);
      const after = JSON.stringify(await w.__rawRows('profiles'));
      const decrypted = await profiles.getLocalProfile();
      return { before, after, name: decrypted?.displayName };
    }, PASS);

    expect(result.before).toContain('Priya Secretname');
    expect(result.after).not.toContain('Priya Secretname');
    expect(result.name).toBe('Priya Secretname');
  });

  test('Legacy plaintext rows are migrated on unlock', async ({ page }) => {
    const result = await page.evaluate(async (pass) => {
      const w = window as unknown as W;
      const vault = await w.__load('/src/security/vaultKeyService.ts');
      const { db } = await w.__load('/src/infrastructure/database/db.ts');
      await vault.initializeVault(pass);
      vault.lockVault();

      // Simulate data written by a version without record encryption.
      await w.__rawPut('documents', {
        id: 'legacy-doc', ownerId: 'local-profile', title: 'LEGACY-PASSPORT-TITLE', category: 'identity',
        sensitivity: 'critical', storagePolicy: 'local-only', tags: ['travel'], createdAt: '', updatedAt: '',
      });

      await vault.unlockVault(pass);
      const raw = JSON.stringify(await w.__rawRows('documents'));
      const doc = await db.documents.get('legacy-doc');
      return { raw, title: doc?.title, tags: doc?.tags };
    }, PASS);

    expect(result.raw).not.toContain('LEGACY-PASSPORT-TITLE');
    expect(result.title).toBe('LEGACY-PASSPORT-TITLE');
    expect(result.tags).toEqual(['travel']);
  });

  test('While locked, secret fields are unreadable and a write-back cannot erase them', async ({ page }) => {
    const result = await page.evaluate(async (pass) => {
      const w = window as unknown as W;
      const vault = await w.__load('/src/security/vaultKeyService.ts');
      const { db } = await w.__load('/src/infrastructure/database/db.ts');
      await vault.initializeVault(pass);
      await db.finance.add({ id: 'fin-1', ownerId: 'local-profile', category: 'bank', institution: 'HDFC', identifier: '1234', createdAt: '', updatedAt: '' });

      vault.lockVault();
      const lockedView = await db.finance.get('fin-1');
      await db.finance.put(lockedView);           // accidental write-back while locked
      await vault.unlockVault(pass);
      const lockedView2 = await db.finance.get('fin-1');
      return { lockedInstitution: lockedView?.institution, afterUnlock: lockedView2?.institution };
    }, PASS);

    expect(result.lockedInstitution).toBeUndefined();
    expect(result.afterUnlock).toBe('HDFC');
  });

  test('Ciphertext moved to another record is rejected (bound to table and id)', async ({ page }) => {
    const message = await page.evaluate(async (pass) => {
      const w = window as unknown as W;
      const vault = await w.__load('/src/security/vaultKeyService.ts');
      const { db } = await w.__load('/src/infrastructure/database/db.ts');
      await vault.initializeVault(pass);
      await db.secrets.add({ id: 'a', ownerId: 'local-profile', title: 'A', category: 'note', value: 'x', createdAt: '', updatedAt: '' });
      await db.secrets.add({ id: 'b', ownerId: 'local-profile', title: 'B', category: 'note', value: 'y', createdAt: '', updatedAt: '' });
      const rows = await w.__rawRows('secrets');
      const a = rows.find((r) => r.id === 'a');
      const b = rows.find((r) => r.id === 'b');
      await w.__rawPut('secrets', { ...b, __enc: a.__enc });
      try {
        await db.secrets.get('b');
        return 'read succeeded';
      } catch (e) {
        return (e as Error).name;
      }
    }, PASS);

    expect(message).toBe('RecordDecryptionError');
  });

  test('Backups made before record encryption (plaintext rows) restore and end up encrypted', async ({ page }) => {
    const result = await page.evaluate(async (pass) => {
      const w = window as unknown as W;
      const vault = await w.__load('/src/security/vaultKeyService.ts');
      const backup = await w.__load('/src/application/backupService.ts');
      const { db } = await w.__load('/src/infrastructure/database/db.ts');
      await vault.initializeVault(pass);

      // Build a v2 envelope whose payload has plain rows, as older versions exported.
      const envelope = JSON.parse(await (await backup.createBackupBlob()).blob.text());
      const payload = { version: 2, timestamp: '', data: {
        vehicles: [{ id: 'veh-1', ownerId: 'local-profile', make: 'Tata', model: 'Nexon', registrationNumber: 'KA01-SECRET', createdAt: '', updatedAt: '' }],
      } };
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, vault.getUnlockedVaultKey(), new TextEncoder().encode(JSON.stringify(payload)));
      envelope.iv = backup.arrayBufferToBase64(iv.buffer);
      envelope.ciphertext = backup.arrayBufferToBase64(ct);

      // Settings restore runs while unlocked; tables absent from the backup are kept.
      await db.properties.add({ id: 'prop-keep', ownerId: 'local-profile', type: 'house', address: 'KEEP-ADDRESS', createdAt: '', updatedAt: '' });
      await backup.restoreVaultFromBackup(new Blob([JSON.stringify(envelope)]), pass);

      return {
        rawVehicles: JSON.stringify(await w.__rawRows('vehicles')),
        reg: (await db.vehicles.get('veh-1'))?.registrationNumber,
        keptAddress: (await db.properties.get('prop-keep'))?.address,
      };
    }, PASS);

    expect(result.rawVehicles).not.toContain('KA01-SECRET');
    expect(result.reg).toBe('KA01-SECRET');
    expect(result.keptAddress).toBe('KEEP-ADDRESS');
  });
});

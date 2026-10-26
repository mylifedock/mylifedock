import { test, expect } from '@playwright/test';

// These tests import app modules from the Vite dev server so they share the
// app's Dexie database and in-memory vault key. Each test gets a fresh context.

test.describe('Backup, restore & biometric data safety', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('Backup round-trip preserves license key and currency preference', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const load = (p: string) => import(/* @vite-ignore */ p);
      const vault = await load('/src/security/vaultKeyService.ts');
      const backup = await load('/src/application/backupService.ts');
      const { db } = await load('/src/infrastructure/database/db.ts');

      await vault.initializeVault('BackupPassword1234');
      localStorage.setItem('mld_pro_license', 'MLD-PRO-test.license');
      localStorage.setItem('mld_preferred_currency', 'EUR');
      await db.documents.add({
        id: 'doc-1', ownerId: 'local-profile', title: 'Passport', category: 'identity',
        sensitivity: 'critical', storagePolicy: 'local-only', tags: [], createdAt: '', updatedAt: '',
      });

      const { blob } = await backup.createBackupBlob();

      localStorage.removeItem('mld_pro_license');
      localStorage.removeItem('mld_preferred_currency');
      await db.documents.clear();
      vault.lockVault();

      const restored = await backup.restoreVaultFromBackup(blob, 'BackupPassword1234');
      return {
        licenseRestored: restored.licenseRestored,
        license: localStorage.getItem('mld_pro_license'),
        currency: localStorage.getItem('mld_preferred_currency'),
        docs: await db.documents.count(),
        unlocked: vault.isVaultUnlocked(),
      };
    });

    expect(result).toEqual({
      licenseRestored: true,
      license: 'MLD-PRO-test.license',
      currency: 'EUR',
      docs: 1,
      unlocked: true,
    });
  });

  test('A restore that fails midway leaves the existing vault untouched', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const load = (p: string) => import(/* @vite-ignore */ p);
      const vault = await load('/src/security/vaultKeyService.ts');
      const backup = await load('/src/application/backupService.ts');
      const { db } = await load('/src/infrastructure/database/db.ts');

      await vault.initializeVault('AtomicPassword1234');
      await db.documents.add({
        id: 'keep-me', ownerId: 'local-profile', title: 'Existing', category: 'other',
        sensitivity: 'normal', storagePolicy: 'local-only', tags: [], createdAt: '', updatedAt: '',
      });
      const securityBefore = await db.vaultSecurity.get('local-vault');

      // Valid envelope, but the products table contains a duplicate primary key,
      // so bulkAdd fails after documents/vaultSecurity were already written.
      const envelope = JSON.parse(await (await backup.createBackupBlob()).blob.text());
      const payload = {
        version: 2,
        timestamp: new Date().toISOString(),
        data: {
          documents: [{ id: 'from-backup', ownerId: 'local-profile', title: 'X', category: 'other', sensitivity: 'normal', storagePolicy: 'local-only', tags: [], createdAt: '', updatedAt: '' }],
          products: [{ id: 'dup', ownerId: 'local-profile' }, { id: 'dup', ownerId: 'local-profile' }],
        },
      };
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, vault.getUnlockedVaultKey(), new TextEncoder().encode(JSON.stringify(payload)));
      envelope.iv = backup.arrayBufferToBase64(iv.buffer);
      envelope.ciphertext = backup.arrayBufferToBase64(ct);

      // Restore always rewrites vaultSecurity.updatedAt; make sure "now" differs.
      await new Promise((r) => setTimeout(r, 20));
      let failed = false;
      try {
        await backup.importVault(new Blob([JSON.stringify(envelope)]), 'AtomicPassword1234');
      } catch {
        failed = true;
      }

      const securityAfter = await db.vaultSecurity.get('local-vault');
      return {
        failed,
        docIds: (await db.documents.toArray()).map((d: { id: string }) => d.id),
        securityUnchanged: securityAfter.updatedAt === securityBefore.updatedAt,
      };
    });

    expect(result.failed).toBe(true);
    expect(result.docIds).toEqual(['keep-me']);
    expect(result.securityUnchanged).toBe(true);
  });

  test('Unlock lockout escalates and survives a page reload', async ({ page }) => {
    const schedule = await page.evaluate(async () => {
      const t = await import(/* @vite-ignore */ '/src/security/unlockThrottle.ts');
      const cooldowns = [];
      for (let i = 0; i < 9; i++) cooldowns.push(t.recordUnlockFailure());
      return { cooldowns, max: t.cooldownSecondsFor(50) };
    });
    expect(schedule.cooldowns).toEqual([0, 0, 5, 5, 15, 30, 60, 120, 240]);
    expect(schedule.max).toBe(900);

    await page.reload();
    const remaining = await page.evaluate(async () => {
      const t = await import(/* @vite-ignore */ '/src/security/unlockThrottle.ts');
      const before = t.remainingCooldownSeconds();
      t.resetUnlockThrottle();
      return { before, after: t.remainingCooldownSeconds() };
    });
    expect(remaining.before).toBeGreaterThan(200);
    expect(remaining.after).toBe(0);
  });

  test('Web build never offers or performs biometric unlock and purges legacy stored passphrases', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const bio = await import(/* @vite-ignore */ '/src/application/biometricService.ts');

      // Simulate credentials left behind by an earlier build.
      localStorage.setItem('mylifedock_biometric_enabled', 'true');
      localStorage.setItem('mylifedock_bio_vault_sec', '{"ct":"x","iv":"y"}');
      localStorage.setItem('mylifedock_bio_wrap_key', 'AAAA');

      const status = await bio.checkBiometrics();
      const enabled = await bio.isBiometricEnabled();
      const leftovers = ['mylifedock_biometric_enabled', 'mylifedock_bio_vault_sec', 'mylifedock_bio_wrap_key']
        .filter((k) => localStorage.getItem(k) !== null);

      const errors: string[] = [];
      for (const fn of [() => bio.promptBiometricAuth(), () => bio.enableBiometricUnlock('SomePassword1234'), () => bio.getPassphraseViaBiometrics()]) {
        try {
          await fn();
          errors.push('no-error');
        } catch {
          errors.push('rejected');
        }
      }
      return { available: status.isAvailable, enabled, leftovers, errors, stored: localStorage.getItem('mylifedock_bio_vault_sec') };
    });

    expect(result.available).toBe(false);
    expect(result.enabled).toBe(false);
    expect(result.leftovers).toEqual([]);
    expect(result.errors).toEqual(['rejected', 'rejected', 'rejected']);
    expect(result.stored).toBeNull();
  });
});

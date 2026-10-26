import { test, expect, type Page } from '@playwright/test';

// The Emergency Family Kit and Subscriptions used to live in plaintext
// localStorage (outside the encrypted vault and outside backups). These tests
// check that they now live in the encrypted profile, that old data migrates,
// and that the exported kit escapes user text.

const PASS = 'LocalDataPass-2026!';

// Dynamically imported app modules and raw IndexedDB rows are untyped here.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Loose = any;
type W = { __load: (p: string) => Promise<Loose>; __rawRows: (s: string) => Promise<Loose[]> };

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
  });
}

test.describe('Emergency kit and subscriptions are encrypted at rest', () => {
  test.beforeEach(async ({ page }) => setup(page));

  test('Legacy plaintext emergency kit migrates into the encrypted profile', async ({ page }) => {
    const result = await page.evaluate(async (pass) => {
      const w = window as unknown as W;
      const vault = await w.__load('/src/security/vaultKeyService.ts');
      const profiles = await w.__load('/src/application/profileService.ts');
      const kit = await w.__load('/src/application/emergencyKitService.ts');
      await profiles.createLocalProfile('Kit Tester');
      await vault.initializeVault(pass);

      localStorage.setItem('mylifedock_emergency_profile', JSON.stringify({
        fullName: 'Kit Tester', bloodGroup: 'O-', allergies: 'SECRET-ALLERGY-PENICILLIN', organDonor: true,
      }));
      const loaded = await kit.getEmergencyProfile();
      const raw = JSON.stringify(await w.__rawRows('profiles'));
      return {
        allergies: loaded.allergies,
        bloodGroup: loaded.bloodGroup,
        organDonor: loaded.organDonor,
        legacyLeft: localStorage.getItem('mylifedock_emergency_profile'),
        plaintextAtRest: raw.includes('SECRET-ALLERGY-PENICILLIN'),
      };
    }, PASS);
    expect(result).toEqual({
      allergies: 'SECRET-ALLERGY-PENICILLIN', bloodGroup: 'O-', organDonor: true, legacyLeft: null, plaintextAtRest: false,
    });
  });

  test('Exported emergency kit escapes user-entered HTML', async ({ page }) => {
    const html = await page.evaluate(async (pass) => {
      const w = window as unknown as W;
      const vault = await w.__load('/src/security/vaultKeyService.ts');
      const profiles = await w.__load('/src/application/profileService.ts');
      const kit = await w.__load('/src/application/emergencyKitService.ts');
      await profiles.createLocalProfile('Escape Tester');
      await vault.initializeVault(pass);
      await kit.saveEmergencyProfile({ ...kit.EMPTY_EMERGENCY_PROFILE, fullName: '<img src=x onerror=alert(1)>', notes: '"quoted" & <b>bold</b>' });
      return kit.generateEmergencySummaryHtml();
    }, PASS);
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(html).toContain('&quot;quoted&quot; &amp; &lt;b&gt;bold&lt;/b&gt;');
    expect(html).toContain("default-src 'none'");
  });

  test('Subscriptions migrate, stay encrypted, and deleting one removes its reminder', async ({ page }) => {
    const result = await page.evaluate(async (pass) => {
      const w = window as unknown as W;
      const vault = await w.__load('/src/security/vaultKeyService.ts');
      const profiles = await w.__load('/src/application/profileService.ts');
      const subs = await w.__load('/src/application/subscriptionService.ts');
      const { db } = await w.__load('/src/infrastructure/database/db.ts');
      await profiles.createLocalProfile('Subs Tester');
      await vault.initializeVault(pass);
      localStorage.setItem('mld_preferred_currency', 'INR');

      localStorage.setItem('mylifedock_subscriptions_list', JSON.stringify([
        { id: 'legacy-1', name: 'SECRET-STREAMING-SERVICE', category: 'entertainment', amount: 499, currency: 'USD',
          billingCycle: 'monthly', nextBillingDate: '2099-01-10', autoRenew: true },
      ]));
      const migrated = await subs.getSubscriptions();

      const added = await subs.saveSubscription({
        name: 'Gym', category: 'health', amount: 30, currency: 'EUR', billingCycle: 'monthly',
        nextBillingDate: '2099-02-10', autoRenew: true,
      });
      const remindersBefore = (await db.reminders.toArray()).filter((r: Loose) => r.relatedEntityId === added.id).length;

      await subs.saveSubscription({ ...added, nextBillingDate: '2099-03-10' }, added.id);
      const updatedReminder = (await db.reminders.toArray()).find((r: Loose) => r.relatedEntityId === added.id);

      await subs.deleteSubscription(added.id);
      const remindersAfter = (await db.reminders.toArray()).filter((r: Loose) => r.relatedEntityId === added.id).length;
      const raw = JSON.stringify(await w.__rawRows('profiles'));

      return {
        migratedName: migrated[0]?.name,
        migratedCurrency: migrated[0]?.currency,
        remaining: (await subs.getSubscriptions()).map((s: Loose) => s.id),
        legacyLeft: localStorage.getItem('mylifedock_subscriptions_list'),
        remindersBefore,
        updatedReminderDate: updatedReminder?.dueDate,
        remindersAfter,
        plaintextAtRest: raw.includes('SECRET-STREAMING-SERVICE'),
      };
    }, PASS);
    expect(result).toEqual({
      migratedName: 'SECRET-STREAMING-SERVICE',
      migratedCurrency: 'INR',
      remaining: ['legacy-1'],
      legacyLeft: null,
      remindersBefore: 1,
      updatedReminderDate: '2099-03-07',
      remindersAfter: 0,
      plaintextAtRest: false,
    });
  });
});

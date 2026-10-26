import { test, expect, type Page } from '@playwright/test';

// Covers the 1.4 restructure: one free-vault limit for every section, family
// members across sections, search that opens the exact record, per-person
// emergency kits, attachment clean-up and India-first date parsing.

const PASS = 'Restructure-Pass-2026';

// Dynamically imported app modules are untyped here.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Loose = any;
type W = { __load: (p: string) => Promise<Loose> };

async function withLoader(page: Page) {
  await page.goto('/');
  await page.evaluate(() => {
    (window as unknown as W).__load = (p: string) => import(/* @vite-ignore */ p);
  });
}

async function onboardAndUnlock(page: Page) {
  await page.goto('/');
  await page.locator('.loading-screen').waitFor({ state: 'detached', timeout: 15000 }).catch(() => {});
  const skip = page.locator('button:has-text("Skip")').first();
  if (await skip.isVisible({ timeout: 1500 }).catch(() => false)) await skip.click();
  await page.fill('input#displayName', 'Section Tester');
  await page.check('input#termsCheckbox');
  await page.click('button:has-text("Create my local vault")');
  await page.fill('input#vaultPassphrase', PASS);
  await page.fill('input#confirmVaultPassphrase', PASS);
  await page.click('button[type="submit"]');
  const cont = page.locator('button:has-text("Continue to MyLifeDock")');
  await cont.waitFor({ state: 'visible', timeout: 20000 });
  await page.check('input[type="checkbox"]');
  await cont.click();
  await expect(page.locator('text="Overview"').first()).toBeVisible({ timeout: 10000 });
}

test.describe('Restructured sections', () => {
  test('The free-vault limit applies to every section, not only Documents/Products/Medical', async ({ page }) => {
    await withLoader(page);
    const outcome = await page.evaluate(async (pass) => {
      const w = window as unknown as W;
      const vault = await w.__load('/src/security/vaultKeyService.ts');
      const profiles = await w.__load('/src/application/profileService.ts');
      const finance = await w.__load('/src/application/financeService.ts');
      const vehicles = await w.__load('/src/application/vehicleService.ts');
      const properties = await w.__load('/src/application/propertyService.ts');
      const secrets = await w.__load('/src/application/secretsService.ts');
      const coverage = await w.__load('/src/application/coverageService.ts');
      const subs = await w.__load('/src/application/subscriptionService.ts');
      const limit = await w.__load('/src/application/vaultLimitService.ts');
      await profiles.createLocalProfile('Limit Tester');
      await vault.initializeVault(pass);

      // Ten free items spread over sections that used to skip the check.
      for (let i = 0; i < 3; i++) await finance.createFinance({ category: 'bank', institution: `Bank ${i}` });
      for (let i = 0; i < 3; i++) await vehicles.createVehicle({ make: 'Maruti', model: `Swift ${i}` });
      for (let i = 0; i < 2; i++) await properties.createProperty({ type: 'house', address: `Flat ${i}` });
      await secrets.createSecret({ title: 'Locker', category: 'pin', value: '1234' });
      await coverage.createCoverage({ type: 'insurance', provider: 'LIC', startDate: '2026-01-01', endDate: '2027-01-01', reminderEnabled: false, reminderDaysBefore: 30 });

      const status = await limit.getVaultQuotaStatus();
      const attempts = new Map<string, string>();
      const attempt = async (name: string, fn: () => Promise<unknown>) => {
        try {
          await fn();
          attempts.set(name, 'saved');
        } catch (error) {
          attempts.set(name, (error as Error).name);
        }
      };
      await attempt('finance', () => finance.createFinance({ category: 'card', institution: 'Extra' }));
      await attempt('vehicle', () => vehicles.createVehicle({ make: 'Honda', model: 'Activa' }));
      await attempt('property', () => properties.createProperty({ type: 'land', address: 'Plot 9' }));
      await attempt('secret', () => secrets.createSecret({ title: 'Extra', category: 'note', value: 'x' }));
      await attempt('insurance', () => coverage.createCoverage({ type: 'insurance', provider: 'Star', startDate: '2026-01-01', endDate: '2027-01-01', reminderEnabled: false, reminderDaysBefore: 30 }));
      await attempt('subscription', () => subs.saveSubscription({ name: 'Netflix', category: 'entertainment', amount: 199, currency: 'INR', billingCycle: 'monthly', nextBillingDate: '2099-01-01', autoRenew: true }));
      return { total: status.totalItems, reached: status.isLimitReached, attempts: [...attempts.values()] };
    }, PASS);

    expect(outcome.total).toBe(10);
    expect(outcome.reached).toBe(true);
    expect(outcome.attempts).toEqual(Array(6).fill('VaultLimitReachedError'));
  });

  test('Search covers family members and subscriptions, and routes each result to its section', async ({ page }) => {
    await withLoader(page);
    const found = await page.evaluate(async (pass) => {
      const w = window as unknown as W;
      const vault = await w.__load('/src/security/vaultKeyService.ts');
      const profiles = await w.__load('/src/application/profileService.ts');
      const docs = await w.__load('/src/application/documentService.ts');
      const subs = await w.__load('/src/application/subscriptionService.ts');
      const search = await w.__load('/src/application/searchService.ts');
      const nav = await w.__load('/src/ui/navigation.ts');
      await profiles.createLocalProfile('Parent');
      await vault.initializeVault(pass);
      const child = await profiles.createDependentProfile({ displayName: 'Aarav', role: 'dependent_child' });

      await docs.createDocument({ title: 'Aarav School ID', category: 'identity', sensitivity: 'normal', storagePolicy: 'local-only', tags: [], ownerId: child.id });
      await subs.saveSubscription({ name: 'Hotstar Premium', category: 'entertainment', amount: 299, currency: 'INR', billingCycle: 'monthly', nextBillingDate: '2099-01-01', autoRenew: true });

      const docResults = await search.universalSearch('school id');
      const subResults = await search.universalSearch('hotstar');
      return {
        docSubtitle: docResults[0]?.subtitle,
        docDestination: docResults[0] && nav.resultDestination(docResults[0]),
        subType: subResults[0]?.type,
        subDestination: subResults[0] && nav.resultDestination(subResults[0]),
        ownerFiltered: (await docs.getDocuments(child.id)).map((d: Loose) => d.title),
        selfFiltered: (await docs.getDocuments('local-profile')).length,
      };
    }, PASS);

    expect(found.docSubtitle).toContain('Aarav');
    expect(found.docDestination.page).toBe('documents');
    expect(found.subType).toBe('subscription');
    expect(found.subDestination).toMatchObject({ page: 'money', tab: 'subscriptions' });
    expect(found.ownerFiltered).toEqual(['Aarav School ID']);
    expect(found.selfFiltered).toBe(0);
  });

  test('Each family member has their own emergency kit; health details live on the profile', async ({ page }) => {
    await withLoader(page);
    const kits = await page.evaluate(async (pass) => {
      const w = window as unknown as W;
      const vault = await w.__load('/src/security/vaultKeyService.ts');
      const profiles = await w.__load('/src/application/profileService.ts');
      const kit = await w.__load('/src/application/emergencyKitService.ts');
      const { db } = await w.__load('/src/infrastructure/database/db.ts');
      await profiles.createLocalProfile('Parent');
      await vault.initializeVault(pass);
      const child = await profiles.createDependentProfile({ displayName: 'Diya', role: 'dependent_child', bloodGroup: 'B+' });

      await kit.saveEmergencyProfile({ ...kit.EMPTY_EMERGENCY_PROFILE, bloodGroup: 'O-', emergencyContactName: 'Spouse' });
      await kit.saveEmergencyProfile({ ...(await kit.getEmergencyProfile(child.id)), allergies: 'Peanuts', emergencyContactName: 'Grandma' }, child.id);

      const self = await kit.getEmergencyProfile();
      const kid = await kit.getEmergencyProfile(child.id);
      const kidProfile = await db.profiles.get(child.id);
      return {
        self: [self.bloodGroup, self.emergencyContactName],
        kid: [kid.fullName, kid.bloodGroup, kid.allergies, kid.emergencyContactName],
        storedOnProfile: [kidProfile.bloodGroup, kidProfile.allergies, kidProfile.emergencyKit?.allergies],
      };
    }, PASS);

    expect(kits.self).toEqual(['O-', 'Spouse']);
    expect(kits.kid).toEqual(['Diya', 'B+', 'Peanuts', 'Grandma']);
    // One place for health details: the profile, not a copy inside the kit.
    expect(kits.storedOnProfile).toEqual(['B+', 'Peanuts', undefined]);
  });

  test('Deleting a vehicle deletes its attachments; empty number fields are not saved as NaN', async ({ page }) => {
    await withLoader(page);
    const result = await page.evaluate(async (pass) => {
      const w = window as unknown as W;
      const vault = await w.__load('/src/security/vaultKeyService.ts');
      const profiles = await w.__load('/src/application/profileService.ts');
      const vehicles = await w.__load('/src/application/vehicleService.ts');
      const attachments = await w.__load('/src/application/attachmentService.ts');
      const { db } = await w.__load('/src/infrastructure/database/db.ts');
      await profiles.createLocalProfile('Owner');
      await vault.initializeVault(pass);

      const id = await vehicles.createVehicle({ make: 'Tata', model: 'Nexon', year: undefined, purchasePrice: undefined });
      const png = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='), (c) => c.charCodeAt(0));
      await attachments.addAttachment({ documentId: id, file: new File([png], 'rc.png', { type: 'image/png' }) });
      const before = await db.attachments.where('documentId').equals(id).count();
      const stored = await db.vehicles.get(id);
      await vehicles.deleteVehicle(id);
      return {
        before,
        after: await db.attachments.where('documentId').equals(id).count(),
        yearIsNaN: Number.isNaN(stored.year),
        priceIsNaN: Number.isNaN(stored.purchasePrice),
      };
    }, PASS);
    expect(result).toEqual({ before: 1, after: 0, yearIsNaN: false, priceIsNaN: false });
  });

  test('Receipt dates are read day-first and never shift a day', async ({ page }) => {
    await withLoader(page);
    const dates = await page.evaluate(async () => {
      const ocr = await (window as unknown as W).__load('/src/application/ocrService.ts');
      return ['Invoice Date: 05/03/2026', 'Date: 25/12/2025', 'Date: 12/25/2025', 'Bill date 2026-07-01'].map(
        (text) => ocr.parseReceiptData(text).date,
      );
    });
    expect(dates).toEqual(['2026-03-05', '2025-12-25', '2025-12-25', '2026-07-01']);
  });

  test('Broken avatars saved by older builds fall back to the role icon', async ({ page }) => {
    await withLoader(page);
    const icons = await page.evaluate(async () => {
      const { profileAvatar } = await (window as unknown as W).__load('/src/ui/profileAvatar.ts');
      return [
        profileAvatar({ avatarIcon: '��', role: 'dependent_child' }),
        profileAvatar({ avatarIcon: '👧', role: 'dependent_child' }),
        profileAvatar({ role: 'spouse' }),
      ];
    });
    expect(icons).toEqual(['👶', '👧', '💑']);
  });

  test('A search result opens that exact record (insurance policy form)', async ({ page }) => {
    await onboardAndUnlock(page);
    await page.evaluate(async () => {
      const coverage = await import(/* @vite-ignore */ '/src/application/coverageService.ts');
      await coverage.createCoverage({
        type: 'insurance', policyKind: 'health', provider: 'Star Health Family Floater', policyNumber: 'SH-778899',
        startDate: '2026-01-01', endDate: '2027-01-01', reminderEnabled: true, reminderDaysBefore: 30,
      });
    });

    await page.locator('form.desktop-search input').fill('SH-778899');
    const result = page.locator('button.search-result', { hasText: 'Star Health Family Floater' });
    await expect(result).toBeVisible({ timeout: 5000 });
    await result.click();

    await expect(page.locator('h1.page-title')).toHaveText('Insurance');
    await expect(page.locator('h3:has-text("Edit Policy")')).toBeVisible();
    await expect(page.locator('input#policy-provider')).toHaveValue('Star Health Family Floater');
  });

  test('A policy linked to a vehicle shows on the vehicle card', async ({ page }) => {
    await onboardAndUnlock(page);
    await page.evaluate(async () => {
      const vehicles = await import(/* @vite-ignore */ '/src/application/vehicleService.ts');
      const coverage = await import(/* @vite-ignore */ '/src/application/coverageService.ts');
      const id = await vehicles.createVehicle({ make: 'Hyundai', model: 'Creta', registrationNumber: 'KA 01 AB 1234' });
      await coverage.createCoverage({
        type: 'insurance', policyKind: 'vehicle', provider: 'ICICI Lombard', startDate: '2026-01-01', endDate: '2027-02-01',
        reminderEnabled: true, reminderDaysBefore: 15, vehicleId: id,
      });
    });

    await page.click('aside button:has-text("Vehicles & Property")');
    const card = page.locator('article.record-card', { hasText: 'Hyundai Creta' });
    await expect(card).toBeVisible();
    await expect(card).toContainText('ICICI Lombard until 2027-02-01');
  });
});

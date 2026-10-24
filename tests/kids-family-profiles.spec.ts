import { test, expect, Page } from '@playwright/test';

async function ensureUnlocked(page: Page) {
  await page.goto('http://localhost:5173');
  await page.locator('.loading-screen').waitFor({ state: 'detached', timeout: 15000 }).catch(() => {});

  const onboardingHeader = page.locator('text="WELCOME TO MYLIFEDOCK"');
  if (await onboardingHeader.isVisible()) {
    await page.fill('input#displayName', 'Family Guardian');
    await page.check('input#termsCheckbox');
    await page.click('button:has-text("Create my local vault")');
    await onboardingHeader.waitFor({ state: 'detached', timeout: 10000 });
  }

  const confirmInput = page.locator('input#confirmVaultPassphrase');
  const isSetup = await confirmInput.isVisible({ timeout: 4000 }).catch(() => false);
  if (isSetup) {
    await page.fill('input#vaultPassphrase', 'TestPassword1234');
    await page.fill('input#confirmVaultPassphrase', 'TestPassword1234');
    await page.click('button[type="submit"]');

    const continueBtn = page.locator('button:has-text("Continue to MyLifeDock")');
    await continueBtn.waitFor({ state: 'visible', timeout: 15000 });
    await page.check('input[type="checkbox"]');
    await continueBtn.click();
  } else {
    const isLocked = await page.locator('input#vaultPassphrase').isVisible({ timeout: 4000 }).catch(() => false);
    if (isLocked) {
      await page.fill('input#vaultPassphrase', 'TestPassword1234');
      await page.click('button[type="submit"]');
    }
  }

  await expect(page.locator('text="Overview"').first()).toBeVisible({ timeout: 10000 });
}

test.describe('Kids & Family Dependent Multi-Profile Suite (Model A)', () => {
  test('Creates a Child Profile and manages it in Settings', async ({ page }) => {
    await ensureUnlocked(page);

    // 1. Go to Settings
    await page.click('button:has-text("Settings & Backup")');
    await expect(page.locator('h3:has-text("Family & Kids Profiles")')).toBeVisible();

    // 2. Open Add Child / Dependent Modal
    await page.click('button:has-text("Add Child / Dependent")');
    await expect(page.locator('text="Add Child / Dependent Profile"')).toBeVisible();

    // 3. Fill Child Information
    await page.fill('input#depName', 'Aarav Sharma');
    await page.fill('input#depDob', '2020-05-15');
    await page.selectOption('select#depBlood', 'O+');
    await page.fill('input#depAllergies', 'Peanuts & Penicillin');
    await page.fill('input#depDoctor', 'Dr. Mehra (+91 98111 22233)');

    // 4. Submit
    await page.click('button:has-text("Create Profile →")');

    // 5. Verify child profile card appears in Settings
    await expect(page.locator('text="Aarav Sharma"').first()).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text="Dependent Child"').first()).toBeVisible();
    await expect(page.locator('text="Blood Group: O+"').or(page.locator('text="O+"')).first()).toBeVisible();
  });

  test('Medical Module: Adds Pediatric Prescription tagged to Child', async ({ page }) => {
    await ensureUnlocked(page);

    // 1. Navigate to Medical Records
    await page.click('button:has-text("Medical & Health Records")');
    await expect(page.locator('h1:has-text("Medical & Health Records")')).toBeVisible();

    // 2. Add Child Profile via Header Switcher
    await page.click('button:has-text("All Family")');
    await page.click('button:has-text("Add Child / Dependent")');
    await page.fill('input#depName', 'Aarav Sharma');
    await page.selectOption('select#depBlood', 'O+');
    await page.fill('input#depAllergies', 'Peanut allergy');
    await page.click('button:has-text("Create Profile →")');

    // 3. Click Add Prescription
    await page.click('button:has-text("+ Add Prescription")');
    await expect(page.locator('h2:has-text("Add Prescription / Lab Report")')).toBeVisible();

    // 4. Fill Prescription details
    await page.fill('input#med-title', 'MMR & Polio Vaccination Booster');
    await page.fill('input#med-department', 'Pediatrics');
    await page.fill('input#med-doctor', 'Apollo Children Hospital');
    await page.fill('input#med-diagnosis', 'Routine 5-Year Immunization');

    // 5. Save
    await page.click('button[type="submit"]:has-text("Save Record")');

    // 6. Verify record is visible and child badge is rendered
    await expect(page.locator('text="MMR & Polio Vaccination Booster"')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text="Aarav Sharma"').first()).toBeVisible();
  });
});

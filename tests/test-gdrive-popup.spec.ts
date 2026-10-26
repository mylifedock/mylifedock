import { test, expect } from '@playwright/test';

test('Google Drive Backup button triggers OAuth popup', async ({ page, context }) => {
  page.on('console', msg => console.log('BROWSER LOG:', msg.type(), msg.text()));

  await page.goto('/');
  await page.locator('.loading-screen').waitFor({ state: 'detached', timeout: 15000 }).catch(() => {});

  const skipBtn = page.locator('button:has-text("Skip")').first();
  if (await skipBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
    await skipBtn.click();
  }

  const onboardingHeader = page.locator('text="WELCOME TO MYLIFEDOCK"');
  if (await onboardingHeader.isVisible({ timeout: 2000 }).catch(() => false)) {
    await page.fill('input#displayName', 'Test User');
    await page.check('input#termsCheckbox');
    await page.click('button:has-text("Create my local vault")');
    await page.waitForTimeout(500);
  }

  const confirmInput = page.locator('input#confirmVaultPassphrase');
  if (await confirmInput.isVisible({ timeout: 2000 }).catch(() => false)) {
    await page.fill('input#vaultPassphrase', 'TestPass123!');
    await page.fill('input#confirmVaultPassphrase', 'TestPass123!');
    await page.click('button[type="submit"]');
    const continueBtn = page.locator('button:has-text("Continue to MyLifeDock")');
    await continueBtn.waitFor({ state: 'visible', timeout: 5000 });
    await page.check('input[type="checkbox"]');
    await continueBtn.click();
  }

  const lockInput = page.locator('input#vaultPassphrase');
  if (await lockInput.isVisible({ timeout: 1000 }).catch(() => false)) {
    await page.fill('input#vaultPassphrase', 'TestPass123!');
    await page.click('button[type="submit"]');
  }

  await expect(page.locator('text="Overview"').first()).toBeVisible({ timeout: 10000 });

  // Open Settings
  const settingsBtn = page.locator('button:has-text("Settings")').first();
  await settingsBtn.click();
  await page.waitForTimeout(1000);

  const backupBtn = page.locator('button:has-text("Backup to Google Drive")');
  await expect(backupBtn).toBeVisible({ timeout: 5000 });

  // Wait for popup
  const popupPromise = context.waitForEvent('page', { timeout: 10000 });
  await backupBtn.click();

  const popup = await popupPromise;
  console.log('POPUP URL DETECTED:', popup.url());
  expect(popup.url()).toContain('accounts.google.com');
  await popup.close();
});

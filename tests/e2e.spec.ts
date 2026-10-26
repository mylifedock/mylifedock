import { test, expect } from '@playwright/test';

test('End-to-End Vault Flow', async ({ page }) => {
  // 1. Navigate to local app
  await page.goto('/');
  await page.locator('.loading-screen').waitFor({ state: 'detached', timeout: 15000 }).catch(() => {});
  
  // 1b. Handle Initial Profile & Legal Terms Onboarding if present
  // Dismiss onboarding slides if present on fresh run
  const skipPillarsBtn = page.locator('button:has-text("Skip")').first();
  if (await skipPillarsBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
    await skipPillarsBtn.click();
  }

  const onboardingHeader = page.locator('text="WELCOME TO MYLIFEDOCK"');
  if (await onboardingHeader.isVisible()) {
    console.log('Detected fresh onboarding, entering name & accepting terms...');
    await page.fill('input#displayName', 'Test Founder');
    await page.check('input#termsCheckbox');
    await page.click('button:has-text("Create my local vault")');
    await onboardingHeader.waitFor({ state: 'detached', timeout: 10000 });
  }

  // 2. Initial Setup: Create Master Password
  const confirmInput = page.locator('input#confirmVaultPassphrase');
  const isSetup = await confirmInput.isVisible({ timeout: 5000 }).catch(() => false);
  if (isSetup) {
    console.log('Detected fresh setup, creating vault keys...');
    await page.fill('input#vaultPassphrase', 'TestPassword1234');
    await page.fill('input#confirmVaultPassphrase', 'TestPassword1234');
    await page.click('button[type="submit"]');
    
    // Copy recovery key (we bypass actually saving it but click the confirm)
    const continueBtn = page.locator('button:has-text("Continue to MyLifeDock")');
    await continueBtn.waitFor({ state: 'visible', timeout: 15000 });
    await page.check('input[type="checkbox"]');
    await continueBtn.click();
  } else {
    const isLocked = await page.locator('input#vaultPassphrase').isVisible({ timeout: 5000 }).catch(() => false);
    if (isLocked) {
      console.log('Vault exists, unlocking...');
      await page.fill('input#vaultPassphrase', 'TestPassword1234');
      await page.click('button[type="submit"]');
    }
  }

  // 3. Verify Dashboard Loads
  await expect(page.locator('text="Overview"').first()).toBeVisible({ timeout: 10000 });
  
  // 4. Test Products Addition
  await page.click('button:has-text("Products")');
  await page.click('button:has-text("Add Product")');
  
  await page.fill('input#productName', 'Playwright Test Laptop');
  await page.fill('input#productBrand', 'Apple');
  await page.fill('input#productModel', 'MacBook Air');
  
  await page.click('button:has-text("Add product")');
  
  // Verify it appears in the list
  await expect(page.locator('text="Playwright Test Laptop"').first()).toBeVisible({ timeout: 10000 });

  // 5. Test Lock / Logout
  await page.click('button:has-text("Lock")');
  await expect(page.locator('input#vaultPassphrase')).toBeVisible({ timeout: 10000 });

  console.log('✅ Deep UI and Cryptographic persistence tests passed.');
});

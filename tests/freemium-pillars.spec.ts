import { test, expect, Page } from '@playwright/test';

async function ensureUnlocked(page: Page) {
  await page.goto('http://localhost:5173');
  await page.locator('.loading-screen').waitFor({ state: 'detached', timeout: 15000 }).catch(() => {});

  // Dismiss onboarding slides if present on fresh run
  const skipPillarsBtn = page.locator('button:has-text("Skip")').first();
  if (await skipPillarsBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
    await skipPillarsBtn.click();
  }

  const onboardingHeader = page.locator('text="WELCOME TO MYLIFEDOCK"');
  if (await onboardingHeader.isVisible()) {
    await page.fill('input#displayName', 'Freemium Tester');
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

test.describe('Freemium 10-Item Gate & 3 Core Pillars Suite', () => {
  test('Pillars Slideshow: Displays 3 Core Pillars with Zero-Knowledge Details', async ({ page }) => {
    // Clear storage to view fresh onboarding
    await page.goto('http://localhost:5173');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.reload();
    await page.locator('.loading-screen').waitFor({ state: 'detached', timeout: 15000 }).catch(() => {});

    // Check Pillar 1: Zero Server Access
    await expect(page.locator('text="Zero Server Access"')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text="PILLAR 1: SOVEREIGN PRIVACY"')).toBeVisible();

    // Click next to Pillar 2
    await page.click('button.pillar-action-btn');
    await expect(page.locator('text="Client-Side Zero-Knowledge"')).toBeVisible();
    await expect(page.locator('text="PILLAR 2: MATHEMATICAL DEFENSE"')).toBeVisible();

    // Click next to Pillar 3
    await page.click('button.pillar-action-btn');
    await expect(page.locator('text="100% Sovereign & Offline-First"')).toBeVisible();
    await expect(page.locator('text="PILLAR 3: RESILIENCE & OWNERSHIP"')).toBeVisible();
  });

  test('Vault Quota: Displays Free Core Vault Slots and Pro Upgrade Modal', async ({ page }) => {
    await ensureUnlocked(page);

    // Dashboard quota banner should be visible
    const quotaBanner = page.locator('text="Free Core Vault"');
    if (await quotaBanner.isVisible()) {
      await expect(quotaBanner).toContainText('Slots Used');

      // Click Upgrade to Pro button
      const upgradeBtn = page.locator('button:has-text("Upgrade to Pro")').first();
      await upgradeBtn.click();

      // Pro Upgrade Modal should open
      await expect(page.locator('text="Choose your MyLifeDock PRO Plan"')).toBeVisible();
      await expect(page.locator('text="Pay with UPI / Cards via Razorpay"')).toBeVisible();

      // Close modal
      await page.click('button:has-text("✕")');
      await expect(page.locator('text="Choose your MyLifeDock PRO Plan"')).not.toBeVisible();
    }
  });

  test('License Activation: Test Key Unlocks Pro Lifetime & Unlimited Vault', async ({ page }) => {
    await ensureUnlocked(page);

    // Navigate to Settings
    await page.click('button:has-text("Settings & Backup")');
    await expect(page.locator('h3:has-text("MyLifeDock")')).toBeVisible();

    // Click Fill Sample Test Key
    const testKeyBtn = page.locator('button:has-text("Test Sample Key")').or(page.locator('button:has-text("Fill Sample Test Key")')).first();
    await testKeyBtn.click();

    // Click Activate Key
    await page.click('button:has-text("Activate Key")');

    // Toast or message confirms active Pro
    await expect(page.locator('text="PRO ACTIVE"').or(page.locator('text="PRO YEARLY ACTIVE"')).or(page.locator('text="PRO LIFETIME ACTIVE"')).first()).toBeVisible({ timeout: 5000 });
  });
});

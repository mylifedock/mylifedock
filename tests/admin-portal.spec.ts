import { test, expect } from '@playwright/test';

test.describe('Founder Admin Portal Auth & Emergency Recovery Suite', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/admin.html');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.reload();
  });

  test('Authenticates successfully with default setup key (MLD-Founder-2026!)', async ({ page }) => {
    await expect(page.locator('#login-view')).toBeVisible();
    await expect(page.locator('#admin-view')).toBeHidden();

    // Fill credentials
    await page.fill('#login-pass', 'MLD-Founder-2026!');
    await page.click('button[type="submit"]');

    // Dashboard should now be visible
    await expect(page.locator('#admin-view')).toBeVisible();
    await expect(page.locator('#login-view')).toBeHidden();
  });

  test('Toggles password visibility between password and text', async ({ page }) => {
    const passInput = page.locator('#login-pass');
    await passInput.fill('Secret123!');
    await expect(passInput).toHaveAttribute('type', 'password');

    // Click toggle button using stable ID
    const toggleBtn = page.locator('#toggle-login-pass');
    await toggleBtn.click();
    await expect(passInput).toHaveAttribute('type', 'text');

    // Click again to hide
    await toggleBtn.click();
    await expect(passInput).toHaveAttribute('type', 'password');
  });

  test('Supports Dual Auth: logs in with custom passcode OR default master setup key', async ({ page }) => {
    // 1. Log in with default
    await page.fill('#login-pass', 'MLD-Founder-2026!');
    await page.click('button[type="submit"]');
    await expect(page.locator('#admin-view')).toBeVisible();

    // 2. Go to Settings tab and change password
    await page.click('button[onclick*="settings"]');
    await expect(page.locator('#tab-settings')).toBeVisible();

    await page.fill('#curr-pass', 'MLD-Founder-2026!');
    await page.fill('#new-pass', 'DineshNewPass2026#');
    await page.click('#tab-settings button:has-text("Update Admin Passcode")');

    // 3. Logout
    await page.click('button:has-text("Logout")');
    await expect(page.locator('#login-view')).toBeVisible();

    // 4. Test login with custom passcode
    await page.fill('#login-pass', 'DineshNewPass2026#');
    await page.click('button[type="submit"]');
    await expect(page.locator('#admin-view')).toBeVisible();

    // 5. Logout again and test fallback with master default key MLD-Founder-2026!
    await page.click('button:has-text("Logout")');
    await expect(page.locator('#login-view')).toBeVisible();

    await page.fill('#login-pass', 'MLD-Founder-2026!');
    await page.click('button[type="submit"]');
    await expect(page.locator('#admin-view')).toBeVisible();
  });

  test('1-Click Reset to Default Passcode resets custom password', async ({ page }) => {
    // Set custom password in localStorage
    await page.evaluate(() => {
      localStorage.setItem('mld_admin_pass', 'CustomForgottenPassword999!');
    });
    await page.reload();

    // Listen for dialog before clicking
    page.once('dialog', async dialog => {
      await dialog.accept();
    });

    const resetBtn = page.locator('button:has-text("Forgot custom passcode? Reset to default setup key")');
    await expect(resetBtn).toBeVisible();
    await resetBtn.click();

    // Verify localStorage was cleared
    const stored = await page.evaluate(() => localStorage.getItem('mld_admin_pass'));
    expect(stored).toBeNull();

    // Verify login works with default setup key
    await page.fill('#login-pass', 'MLD-Founder-2026!');
    await page.click('button[type="submit"]');
    await expect(page.locator('#admin-view')).toBeVisible();
  });

  test('URL query parameter (?reset=1) auto-resets custom password to default', async ({ page }) => {
    // Set custom password in localStorage
    await page.evaluate(() => {
      localStorage.setItem('mld_admin_pass', 'SomeLockedPassword888!');
    });

    // Navigate to ?reset=1
    await page.goto('/admin.html?reset=1');

    // Verify localStorage key is removed
    const stored = await page.evaluate(() => localStorage.getItem('mld_admin_pass'));
    expect(stored).toBeNull();

    // Verify login works immediately with default setup key
    await page.fill('#login-pass', 'MLD-Founder-2026!');
    await page.click('button[type="submit"]');
    await expect(page.locator('#admin-view')).toBeVisible();
  });
});

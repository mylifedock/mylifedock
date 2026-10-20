import { test, expect } from '@playwright/test';

test.describe('Security Audit & Zero-Knowledge Verification Suite', () => {
  test('Zero-Knowledge Storage Inspection: No Plaintext Passphrases Stored', async ({ page }) => {
    await page.goto('http://localhost:5173');
    await page.locator('.loading-screen').waitFor({ state: 'detached', timeout: 15000 }).catch(() => {});

    // Complete onboarding if present
    const onboardingHeader = page.locator('text="WELCOME TO MYLIFEDOCK"');
    if (await onboardingHeader.isVisible()) {
      await page.fill('input#displayName', 'Security Audit Subject');
      await page.check('input#termsCheckbox');
      await page.click('button.primary-button');
      await onboardingHeader.waitFor({ state: 'detached', timeout: 10000 });
    }

    // Set passphrase if fresh setup
    const confirmInput = page.locator('input#confirmVaultPassphrase');
    const isSetup = await confirmInput.isVisible({ timeout: 4000 }).catch(() => false);
    const testSecretPassphrase = 'AuditSecretPassword2026!';
    if (isSetup) {
      await page.fill('input#vaultPassphrase', testSecretPassphrase);
      await page.fill('input#confirmVaultPassphrase', testSecretPassphrase);
      await page.click('button[type="submit"]');

      const continueBtn = page.locator('button:has-text("Continue to MyLifeDock")');
      await continueBtn.waitFor({ state: 'visible', timeout: 15000 });
      await page.check('input[type="checkbox"]');
      await continueBtn.click();
    }

    // Verify Dashboard is reached
    await expect(page.locator('text="Overview"').first()).toBeVisible({ timeout: 10000 });

    // Inspect localStorage & sessionStorage for any leakage of plaintext passphrase
    const storageAudit = await page.evaluate((secret) => {
      const localKeys = Object.keys(localStorage);
      const sessionKeys = Object.keys(sessionStorage);

      let foundSecretInLocalStorage = false;
      for (const k of localKeys) {
        const val = localStorage.getItem(k) || '';
        if (val.includes(secret) || k.includes(secret)) {
          foundSecretInLocalStorage = true;
        }
      }

      let foundSecretInSessionStorage = false;
      for (const k of sessionKeys) {
        const val = sessionStorage.getItem(k) || '';
        if (val.includes(secret) || k.includes(secret)) {
          foundSecretInSessionStorage = true;
        }
      }

      return {
        foundSecretInLocalStorage,
        foundSecretInSessionStorage,
        keysInLocal: localKeys,
      };
    }, testSecretPassphrase);

    expect(storageAudit.foundSecretInLocalStorage).toBe(false);
    expect(storageAudit.foundSecretInSessionStorage).toBe(false);
  });

  test('Content Security Policy (CSP) & Defense-in-Depth Meta Tag Verification', async ({ page }) => {
    await page.goto('http://localhost:5173');

    const cspHeader = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content');
    expect(cspHeader).not.toBeNull();
    expect(cspHeader).toContain("default-src 'self'");
    expect(cspHeader).toContain("object-src 'none'");
    expect(cspHeader).toContain("base-uri 'self'");
  });

  test('XSS Sanitization & Input Injection Defense', async ({ page }) => {
    await page.goto('http://localhost:5173');
    await page.locator('.loading-screen').waitFor({ state: 'detached', timeout: 15000 }).catch(() => {});

    // Ensure app is unlocked
    const isLocked = await page.locator('input#vaultPassphrase').isVisible({ timeout: 4000 }).catch(() => false);
    if (isLocked) {
      await page.fill('input#vaultPassphrase', 'AuditSecretPassword2026!');
      await page.click('button[type="submit"]');
      await expect(page.locator('text="Overview"').first()).toBeVisible({ timeout: 10000 });
    }

    // Set up alert dialog listener: If an alert is triggered, the test catches it
    let alertTriggered = false;
    page.on('dialog', (dialog) => {
      alertTriggered = true;
      void dialog.dismiss();
    });

    // Attempt XSS payload injection via Universal Search
    const searchBtn = page.locator('button:has-text("Search")').first();
    if (await searchBtn.isVisible()) {
      await searchBtn.click();
      const searchInput = page.locator('input[type="text"], input[type="search"]').first();
      await searchInput.fill('<img src="x" onerror="alert(1)">');
      await page.waitForTimeout(500);
    }

    expect(alertTriggered).toBe(false);
  });
});

import { test, expect, Page } from '@playwright/test';

async function ensureUnlocked(page: Page) {
  await page.goto('/');
  await page.locator('.loading-screen').waitFor({ state: 'detached', timeout: 15000 }).catch(() => {});

  // Dismiss onboarding slides if present on fresh run
  const skipPillarsBtn = page.locator('button:has-text("Skip")').first();
  if (await skipPillarsBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
    await skipPillarsBtn.click();
  }

  const onboardingHeader = page.locator('text="WELCOME TO MYLIFEDOCK"');
  if (await onboardingHeader.isVisible()) {
    await page.fill('input#displayName', 'Feedback Tester');
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

test.describe('Help & Feedback', () => {
  test('Feedback form: type, subject, message and diagnostics opt-in', async ({ page }) => {
    await ensureUnlocked(page);

    await page.click('aside button:has-text("Help & Feedback")');
    await expect(page.locator('h1.page-title:has-text("Help & Feedback")')).toBeVisible();

    const form = page.locator('section[aria-labelledby="feedback-title"]');
    await expect(form.locator('#feedback-title')).toHaveText('Send feedback or ask for help');

    // Sending stays disabled until there is a message.
    const send = form.locator('button:has-text("Open in email app")');
    await expect(send).toBeDisabled();

    const bug = form.getByRole('radio', { name: /Bug report/ });
    const feature = form.getByRole('radio', { name: /Feature request/ });
    await feature.click();
    await expect(feature).toHaveAttribute('aria-checked', 'true');
    await expect(bug).toHaveAttribute('aria-checked', 'false');

    await page.fill('input#fb-subject', 'Camera scanner test');
    await page.fill('textarea#fb-message', 'This is a test feedback message to verify the founder receives formatted feedback.');
    await expect(page.locator('input#fb-diag')).toBeChecked();
    await expect(send).toBeEnabled();
  });

  test('FAQ answers expand and collapse; the old feedback entry points are gone', async ({ page }) => {
    await ensureUnlocked(page);

    // One place for support: no separate "Send Feedback" or "About" items.
    await expect(page.locator('aside button:has-text("Send Feedback")')).toHaveCount(0);
    await expect(page.locator('aside button:has-text("About & Support")')).toHaveCount(0);

    await page.click('aside button:has-text("Help & Feedback")');
    const question = page.getByRole('button', { name: /forgot my Master Passphrase/ });
    await expect(question).toHaveAttribute('aria-expanded', 'false');
    await question.click();
    await expect(question).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('text=64-character Recovery Key')).toBeVisible();
    await question.click();
    await expect(question).toHaveAttribute('aria-expanded', 'false');
  });
});
import { test, expect, Page } from '@playwright/test';

async function ensureUnlocked(page: Page) {
  await page.goto('http://localhost:5173');
  await page.locator('.loading-screen').waitFor({ state: 'detached', timeout: 15000 }).catch(() => {});

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

test.describe('Feedback Submission Form Suite', () => {
  test('Opens Feedback Modal from Sidebar and interacts with fields', async ({ page }) => {
    await ensureUnlocked(page);

    // Click "Send Feedback" in sidebar
    const feedbackNavBtn = page.locator('button:has-text("Send Feedback")');
    await expect(feedbackNavBtn).toBeVisible();
    await feedbackNavBtn.click();

    // Verify modal appears
    const modalTitle = page.locator('#feedback-modal-title');
    await expect(modalTitle).toBeVisible();
    await expect(modalTitle).toHaveText('Share Your Thoughts');

    // Verify category chips
    const bugReportChip = page.locator('button:has-text("Bug Report")');
    await expect(bugReportChip).toBeVisible();
    await bugReportChip.click();

    // Select 5-star rating
    const starBtn = page.locator('button[title="5 Stars"]');
    await expect(starBtn).toBeVisible();
    await starBtn.click();

    // Fill inputs
    await page.fill('input#fb-subject', 'Camera scanner test');
    await page.fill('textarea#fb-message', 'This is a test feedback message to verify the founder receives formatted feedback.');
    await page.fill('input#fb-name', 'Test User');
    await page.fill('input#fb-email', 'tester@example.com');

    // Verify diagnostics checkbox is present
    const diagCheckbox = page.locator('input#fb-diag');
    await expect(diagCheckbox).toBeChecked();

    // Close modal
    await page.click('button:has-text("Cancel")');
    await expect(modalTitle).not.toBeVisible();
  });

  test('Opens Feedback Modal from Settings Page card', async ({ page }) => {
    await ensureUnlocked(page);

    // Navigate to Settings
    await page.click('button:has-text("Settings & Backup")');
    await expect(page.locator('h1.page-title:has-text("Settings")')).toBeVisible();

    // Locate feedback card
    const feedbackCard = page.locator('text="Share Feedback & Feature Requests"');
    await expect(feedbackCard).toBeVisible();

    // Click Submit Feedback
    const submitBtn = page.locator('button:has-text("Submit Feedback →")');
    await expect(submitBtn).toBeVisible();
    await submitBtn.click();

    // Verify modal is open
    const modalTitle = page.locator('#feedback-modal-title');
    await expect(modalTitle).toBeVisible();

    // Close modal via close button
    await page.click('button[aria-label="Close feedback modal"]');
    await expect(modalTitle).not.toBeVisible();
  });
});

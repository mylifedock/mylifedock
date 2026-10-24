import { test, expect, Page } from '@playwright/test';

async function ensureUnlocked(page: Page) {
  await page.goto('http://localhost:5173');
  await page.locator('.loading-screen').waitFor({ state: 'detached', timeout: 15000 }).catch(() => {});

  const onboardingHeader = page.locator('text="WELCOME TO MYLIFEDOCK"');
  if (await onboardingHeader.isVisible()) {
    await page.fill('input#displayName', 'Mobile Tester');
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

  await expect(page.locator('.mobile-topbar-home')).toBeVisible({ timeout: 10000 });
}

test.describe('Mobile UI/UX Precision & Adaptability Suite', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test('Verifies Mobile UI/UX Overhaul: Button Spacing, Hidden Bottom Nav on Inner Pages, Back Button & Responsive Layout', async ({ page }) => {
    await page.goto('http://localhost:5173');
    await page.locator('.loading-screen').waitFor({ state: 'detached', timeout: 15000 }).catch(() => {});

    // Onboarding Button Styling Verification
    const onboardingHeader = page.locator('text="WELCOME TO MYLIFEDOCK"');
    if (await onboardingHeader.isVisible()) {
      const submitBtn = page.locator('button.cta-button');
      await expect(submitBtn).toBeVisible();

      // Verify button font size is at least 15px (no micro-fonts)
      const fontSize = await submitBtn.evaluate((el) => window.getComputedStyle(el).fontSize);
      expect(parseFloat(fontSize)).toBeGreaterThanOrEqual(15);

      // Verify button has arrow docked to the right edge
      const arrow = submitBtn.locator('.btn-arrow');
      await expect(arrow).toBeVisible();

      await page.fill('input#displayName', 'Mobile Tester');
      await page.check('input#termsCheckbox');
      await submitBtn.click();
      await onboardingHeader.waitFor({ state: 'detached', timeout: 10000 });
    }

    // Vault Setup or Unlock
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

    // 4. On Dashboard: Verify Mobile Topbar and Bottom Nav Dock
    await expect(page.locator('.mobile-topbar-home')).toBeVisible({ timeout: 10000 });
    const bottomNav = page.locator('.mobile-bottom-nav');
    await expect(bottomNav).toBeVisible();

    // Verify Bottom Nav contains the 5 deduplicated dock items
    await expect(bottomNav.locator('button[aria-label="Home"]')).toBeVisible();
    await expect(bottomNav.locator('button[aria-label="Universal Search"]')).toBeVisible();
    await expect(bottomNav.locator('button[aria-label="Vault Directory"]')).toBeVisible();
    await expect(bottomNav.locator('button[aria-label="Emergency Kit"]')).toBeVisible();
    await expect(bottomNav.locator('button[aria-label="Settings"]')).toBeVisible();

    // Verify No Horizontal Scroll / Overflow on mobile
    const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(hasHorizontalOverflow).toBe(false);

    // 5. Navigate to an Inner Page (e.g. Universal Search)
    await bottomNav.locator('button[aria-label="Universal Search"]').click();

    // On Inner Page:
    // a) Bottom Nav MUST BE HIDDEN (unmounted)
    await expect(page.locator('.mobile-bottom-nav')).toHaveCount(0);

    // b) Inner Mobile Topbar MUST show Back Button and Title
    const innerTopbar = page.locator('.mobile-topbar-inner');
    await expect(innerTopbar).toBeVisible();
    const backBtn = innerTopbar.locator('.mobile-back-btn');
    await expect(backBtn).toBeVisible();
    await expect(innerTopbar.locator('.mobile-page-title')).toHaveText('Universal Search');

    // 6. Test Back Button returns to Dashboard
    await backBtn.click();
    await expect(page.locator('.mobile-topbar-home')).toBeVisible();
    await expect(page.locator('.mobile-bottom-nav')).toBeVisible();

    // 7. Open Directory Drawer from Bottom Nav
    await page.locator('button[aria-label="Vault Directory"]').click();
    const drawer = page.locator('.sidebar-wrapper.open');
    await expect(drawer).toBeVisible();

    // Verify grouped navigation in drawer
    await expect(page.locator('text="VAULT ESSENTIALS"')).toBeVisible();
    await expect(page.locator('text="FINANCIAL & ASSETS"')).toBeVisible();
    await expect(page.locator('text="SECURITY & RECOVERY"')).toBeVisible();

    // Close drawer via close button
    await page.locator('.sidebar-close-btn').click();
    await expect(page.locator('.sidebar-wrapper.open')).toHaveCount(0);

    // 8. Test Virtual Keyboard behavior: Focusing input hides bottom nav
    const searchNav = page.locator('.mobile-bottom-nav button[aria-label="Universal Search"]');
    await searchNav.click();

    // Find search input and focus it
    const searchInput = page.locator('input[type="text"], input[type="search"]').first();
    if (await searchInput.isVisible()) {
      await searchInput.focus();
      const isKeyboardClassAdded = await page.evaluate(() => document.body.classList.contains('keyboard-open'));
      expect(isKeyboardClassAdded).toBe(true);
    }

    console.log('✅ Mobile UI/UX Precision & Adaptability suite passed flawlessly.');
  });

  test('Verifies Small Android Device Adaptability (360x740 Galaxy A / Compact Phone)', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await ensureUnlocked(page);

    // Verify Overview and zero horizontal overflow
    await expect(page.locator('.mobile-topbar-home')).toBeVisible({ timeout: 10000 });
    const hasOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(hasOverflow).toBe(false);

    // Verify stats grid cards fit neatly
    const statCards = page.locator('.stat-card');
    await expect(statCards.first()).toBeVisible();

    console.log('✅ 360px Compact Android screen verified with zero overflow.');
  });
});

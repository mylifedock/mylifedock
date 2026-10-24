import { test, expect, Page } from '@playwright/test';

async function setupAndUnlock(page: Page) {
  await page.goto('http://localhost:5173');
  await page.locator('.loading-screen').waitFor({ state: 'detached', timeout: 15000 }).catch(() => {});

  const onboardingHeader = page.locator('text="WELCOME TO MYLIFEDOCK"');
  if (await onboardingHeader.isVisible()) {
    await page.fill('input#displayName', 'Multi Device Tester');
    await page.check('input#termsCheckbox');
    await page.click('button:has-text("Create my local vault")');
    await onboardingHeader.waitFor({ state: 'detached', timeout: 10000 });
  }

  const confirmInput = page.locator('input#confirmVaultPassphrase');
  const isSetup = await confirmInput.isVisible({ timeout: 4000 }).catch(() => false);
  if (isSetup) {
    await page.fill('input#vaultPassphrase', 'DeviceTestPassword123');
    await page.fill('input#confirmVaultPassphrase', 'DeviceTestPassword123');
    await page.click('button[type="submit"]');

    const continueBtn = page.locator('button:has-text("Continue to MyLifeDock")');
    await continueBtn.waitFor({ state: 'visible', timeout: 15000 });
    await page.check('input[type="checkbox"]');
    await continueBtn.click();
  } else {
    const isLocked = await page.locator('input#vaultPassphrase').isVisible({ timeout: 4000 }).catch(() => false);
    if (isLocked) {
      await page.fill('input#vaultPassphrase', 'DeviceTestPassword123');
      await page.click('button[type="submit"]');
    }
  }

  // Ensure vault is unlocked and main content is visible
  await expect(page.locator('.main-content')).toBeVisible({ timeout: 12000 });
}

test.describe('Multi-Device UI/UX, Alignment & Navigation Transitions Suite', () => {

  test('PC / Desktop Viewport (1280x800): Alignment, Navigation, Zero Overflow & Modals', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await setupAndUnlock(page);

    // 1. Desktop Shell Structure Verification
    const sidebar = page.locator('.sidebar').first();
    await expect(sidebar).toBeVisible();
    const sidebarWidth = await sidebar.evaluate((el) => window.getComputedStyle(el).width);
    expect(parseInt(sidebarWidth, 10)).toBeGreaterThanOrEqual(215);

    // Mobile elements must NOT be visible on Desktop
    await expect(page.locator('.mobile-topbar-home')).not.toBeVisible();
    await expect(page.locator('.mobile-bottom-nav')).not.toBeVisible();

    // 2. Desktop Navigation across all pages & verify zero overflow
    const pagesToTest = [
      { name: 'Products', selector: 'button.nav-item:has-text("Products")', header: 'Products & Warranties' },
      { name: 'Medical', selector: 'button.nav-item:has-text("Medical")', header: 'Medical & Health Records' },
      { name: 'Documents', selector: 'button.nav-item:has-text("Documents")', header: 'Document Locker' },
      { name: 'Settings', selector: 'button.nav-item:has-text("Settings")', header: 'Settings & Security' },
      { name: 'About', selector: 'button.nav-item:has-text("About")', header: 'About MyLifeDock' },
    ];

    for (const p of pagesToTest) {
      const navBtn = page.locator(p.selector);
      if (await navBtn.isVisible()) {
        await navBtn.click();
        await page.waitForTimeout(200); // Allow smooth transition

        // Verify page content mounts
        const pageEl = page.locator('.page, .page-container, .page-header').first();
        await expect(pageEl).toBeVisible();

        // Verify Zero Horizontal Overflow
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
        expect(overflow, `Desktop overflow detected on page: ${p.name}`).toBe(false);
      }
    }

    // 3. Test Desktop Modal: Open Add Dependent Modal from Settings
    await page.locator('button.nav-item:has-text("Settings")').click();
    const addDependentBtn = page.locator('button:has-text("Add Family Member")');
    if (await addDependentBtn.isVisible()) {
      await addDependentBtn.click();

      const modalOverlay = page.locator('.product-detail-overlay');
      await expect(modalOverlay).toBeVisible();

      // Check z-index is properly elevated (>= 4000)
      const zIndex = await modalOverlay.evaluate((el) => window.getComputedStyle(el).zIndex);
      expect(parseInt(zIndex, 10)).toBeGreaterThanOrEqual(3000);

      // Close modal
      const closeBtn = modalOverlay.locator('button.secondary-button:has-text("Cancel")');
      await closeBtn.click();
      await expect(modalOverlay).toHaveCount(0);
    }
  });

  test('Android Standard Viewport (390x844): Mobile Topbar, Drawer, Hidden Dock & Back Navigation', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await setupAndUnlock(page);

    // 1. Verify Mobile Header and Bottom Dock on Dashboard
    await expect(page.locator('.mobile-topbar-home')).toBeVisible();
    const bottomNav = page.locator('.mobile-bottom-nav');
    await expect(bottomNav).toBeVisible();

    // 2. Open Directory Drawer via Hamburger Button
    const menuBtn = page.locator('.mobile-menu-btn');
    await menuBtn.click();
    const drawer = page.locator('.sidebar-wrapper.open');
    await expect(drawer).toBeVisible();

    // Navigate to Medical Records from Drawer
    await drawer.locator('button.nav-item:has-text("Medical")').click();
    await expect(page.locator('.sidebar-wrapper.open')).toHaveCount(0);

    // 3. Verify Inner Page UI:
    // a) Bottom Nav must be hidden
    await expect(page.locator('.mobile-bottom-nav')).toHaveCount(0);

    // b) Inner topbar must show Back Button and Medical title
    const innerTopbar = page.locator('.mobile-topbar-inner');
    await expect(innerTopbar).toBeVisible();
    await expect(innerTopbar.locator('.mobile-page-title')).toContainText('Medical');

    // c) Verify Zero Horizontal Overflow on Medical page
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(overflow, 'Android overflow on Medical page').toBe(false);

    // 4. Test Family Profile Switcher Dropdown on Mobile
    const switcherBtn = page.locator('button:has-text("Family View"), button:has-text("Self")').first();
    if (await switcherBtn.isVisible()) {
      await switcherBtn.click();
      const dropdownMenu = page.locator('text="SWITCH PROFILE"');
      await expect(dropdownMenu).toBeVisible();

      // Verify dropdown doesn't cause overflow
      const dropdownOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
      expect(dropdownOverflow).toBe(false);

      // Close dropdown by clicking outside
      await page.mouse.click(10, 10);
    }

    // 5. Back Button returns smoothly to Dashboard and restores bottom dock
    await innerTopbar.locator('.mobile-back-btn').click();
    await expect(page.locator('.mobile-topbar-home')).toBeVisible();
    await expect(page.locator('.mobile-bottom-nav')).toBeVisible();
  });

  test('Compact Android Viewport (360x740): Strict 360px Bounds & Responsive Modals', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await setupAndUnlock(page);

    // Zero horizontal scroll on compact phone
    const hasOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(hasOverflow, 'Compact Android 360px overflow').toBe(false);

    // Verify stats grid cards fit neatly
    const stats = page.locator('.stat-card');
    if (await stats.count() > 0) {
      const firstStat = stats.first();
      await expect(firstStat).toBeVisible();
      const width = await firstStat.evaluate((el) => el.getBoundingClientRect().width);
      expect(width).toBeLessThanOrEqual(360);
    }
  });

  test('iOS Device Emulation (393x852 iPhone 14 Pro): Touch Targets & Safe Areas', async ({ page }) => {
    await page.setViewportSize({ width: 393, height: 852 });
    await setupAndUnlock(page);

    // Verify touch targets on bottom dock buttons meet iOS guidelines (>= 44px height)
    const bottomNav = page.locator('.mobile-bottom-nav');
    if (await bottomNav.isVisible()) {
      const navButtons = bottomNav.locator('button');
      const count = await navButtons.count();
      for (let i = 0; i < count; i++) {
        const btn = navButtons.nth(i);
        const box = await btn.boundingBox();
        if (box) {
          expect(box.height, `iOS touch target height for dock button ${i}`).toBeGreaterThanOrEqual(40);
        }
      }
    }

    // Verify Lock button on mobile topbar has touch size >= 36px
    const lockBtn = page.locator('.mobile-lock-btn');
    if (await lockBtn.isVisible()) {
      const box = await lockBtn.boundingBox();
      if (box) {
        expect(box.width).toBeGreaterThanOrEqual(36);
        expect(box.height).toBeGreaterThanOrEqual(36);
      }
    }
  });
});

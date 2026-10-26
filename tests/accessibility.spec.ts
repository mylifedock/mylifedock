import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// WCAG 2.1 A/AA scan of the main screens with axe-core (runs locally).
// Serious and critical violations fail the test. Reduced motion makes the
// entrance animations finish instantly so contrast is measured on final colors.
test.use({ reducedMotion: 'reduce' });

const PASS = 'AxePassword1234';

async function scan(page: Page, label: string) {
  // Let route/unlock transitions settle so contrast is measured on the final UI.
  await page.waitForTimeout(800);
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  const blocking = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  const summary = blocking.map((v) => `${label}: [${v.impact}] ${v.id} (${v.nodes.length}) ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`);
  return summary;
}

async function onboardAndUnlock(page: Page) {
  await page.goto('/');
  await page.locator('.loading-screen').waitFor({ state: 'detached', timeout: 15000 }).catch(() => {});
  const skip = page.locator('button:has-text("Skip")').first();
  if (await skip.isVisible({ timeout: 2000 }).catch(() => false)) await skip.click();
  await page.fill('input#displayName', 'Axe Tester');
  await page.check('input#termsCheckbox');
  await page.click('button:has-text("Create my local vault")');
  await page.locator('input#confirmVaultPassphrase').waitFor();
}

test('Main screens have no serious or critical WCAG 2.1 AA violations', async ({ page }) => {
  test.setTimeout(120_000);
  const problems: string[] = [];

  await onboardAndUnlock(page);
  problems.push(...(await scan(page, 'vault setup')));

  await page.fill('input#vaultPassphrase', PASS);
  await page.fill('input#confirmVaultPassphrase', PASS);
  await page.click('button[type="submit"]');
  await page.locator('button:has-text("Continue to MyLifeDock")').waitFor({ timeout: 20000 });
  problems.push(...(await scan(page, 'recovery key')));
  await page.check('input[type="checkbox"]');
  await page.click('button:has-text("Continue to MyLifeDock")');
  await expect(page.locator('text="Overview"').first()).toBeVisible({ timeout: 10000 });
  problems.push(...(await scan(page, 'dashboard')));

  // Every sidebar section, plus the tabs inside merged sections.
  const pages: { nav: string; tabs?: string[] }[] = [
    { nav: 'Documents' },
    { nav: 'Products & Warranties' },
    { nav: 'Reminders' },
    { nav: 'Insurance' },
    { nav: 'Money', tabs: ['Subscriptions'] },
    { nav: 'Vehicles & Property', tabs: ['Properties'] },
    { nav: 'Medical & Health' },
    { nav: 'Secrets' },
    { nav: 'Emergency Kit' },
    { nav: 'Settings & Backup', tabs: ['Security', 'Family', 'Preferences', 'Plan'] },
    { nav: 'Help & Feedback' },
  ];
  for (const { nav, tabs = [] } of pages) {
    const button = page.locator(`aside button:has-text("${nav}")`).first();
    if (!(await button.isVisible().catch(() => false))) {
      problems.push(`${nav}: navigation button not found`);
      continue;
    }
    await button.click();
    await page.waitForTimeout(300);
    problems.push(...(await scan(page, nav)));
    for (const tab of tabs) {
      await page.getByRole('tab', { name: tab }).click();
      problems.push(...(await scan(page, `${nav} › ${tab}`)));
    }
  }

  // Search results page (opened from the search bar at the top).
  await page.locator('form.desktop-search input').fill('test');
  await page.locator('.search-page-input').waitFor();
  problems.push(...(await scan(page, 'Search')));

  console.log(problems.join('\n') || 'no serious/critical violations');
  expect(problems).toEqual([]);
});

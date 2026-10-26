import { test, expect, type Page } from '@playwright/test';

// Covers the cross-platform helpers used by the Android, iOS and Windows apps:
// background-lock guard, share-file names, desktop Google sign-in redirect
// parsing and prototype-safe record handling.

const PASS = 'PlatformFlows-Pass-2026';

// Dynamically imported app modules are untyped here.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Loose = any;
type W = { __load: (p: string) => Promise<Loose> };

async function withLoader(page: Page) {
  await page.goto('/');
  await page.evaluate(() => {
    (window as unknown as W).__load = (p: string) => import(/* @vite-ignore */ p);
  });
}

async function onboardAndUnlock(page: Page) {
  await page.goto('/');
  await page.locator('.loading-screen').waitFor({ state: 'detached', timeout: 15000 }).catch(() => {});
  const skip = page.locator('button:has-text("Skip")').first();
  if (await skip.isVisible({ timeout: 1500 }).catch(() => false)) await skip.click();

  const header = page.locator('text="WELCOME TO MYLIFEDOCK"');
  if (await header.isVisible({ timeout: 2000 }).catch(() => false)) {
    await page.fill('input#displayName', 'Platform Tester');
    await page.check('input#termsCheckbox');
    await page.click('button:has-text("Create my local vault")');
    await header.waitFor({ state: 'detached', timeout: 10000 });
  }
  const confirm = page.locator('input#confirmVaultPassphrase');
  if (await confirm.isVisible({ timeout: 4000 }).catch(() => false)) {
    await page.fill('input#vaultPassphrase', PASS);
    await page.fill('input#confirmVaultPassphrase', PASS);
    await page.click('button[type="submit"]');
    const cont = page.locator('button:has-text("Continue to MyLifeDock")');
    await cont.waitFor({ state: 'visible', timeout: 15000 });
    await page.check('input[type="checkbox"]');
    await cont.click();
  }
  await expect(page.locator('text="Overview"').first()).toBeVisible({ timeout: 10000 });
}

async function setHidden(page: Page, hidden: boolean) {
  await page.evaluate((value) => {
    Object.defineProperty(document, 'hidden', { value, configurable: true });
    Object.defineProperty(document, 'visibilityState', { value: value ? 'hidden' : 'visible', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  }, hidden);
}

test.describe('Cross-platform flows', () => {
  test('External-activity guard: flows mark and release correctly', async ({ page }) => {
    await withLoader(page);
    const result = await page.evaluate(async () => {
      const m = await (window as unknown as W).__load('/src/platform/externalActivity.ts');
      const states: boolean[] = [];
      states.push(m.isExternalActivityActive());
      let inside = false;
      await m.withExternalActivity(async () => { inside = m.isExternalActivityActive(); });
      states.push(inside, m.isExternalActivityActive());
      await m.withExternalActivity(async () => { throw new Error('flow failed'); }).catch(() => {});
      states.push(m.isExternalActivityActive());
      m.markExternalActivity(1_000);
      states.push(m.isExternalActivityActive(2_000), m.isExternalActivityActive(1_000 + 11 * 60 * 1000));
      m.clearExternalActivityMark();
      states.push(m.isExternalActivityActive());
      return states;
    });
    // idle, inside a flow, after it, after a failing flow, marked, mark expired, cleared
    expect(result).toEqual([false, true, false, false, true, false, false]);
  });

  test('Share file names cannot escape the cache folder', async ({ page }) => {
    await withLoader(page);
    const names = await page.evaluate(async () => {
      const { sanitizeFileName } = await (window as unknown as W).__load('/src/platform/fileExport.ts');
      return ['../../etc/passwd', 'a\\b:c*?.pdf', '...hidden', '', 'x'.repeat(300), 'Invoice 2026.pdf'].map(sanitizeFileName);
    });
    expect(names[0]).not.toContain('/');
    expect(names[0].startsWith('.')).toBe(false);
    expect(names[1]).toBe('a_b_c__.pdf');
    expect(names[2]).toBe('hidden');
    expect(names[3]).toBe('file');
    expect(names[4].length).toBe(120);
    expect(names[5]).toBe('Invoice 2026.pdf');
  });

  test('Desktop Google sign-in redirect: state, consent and scope are enforced', async ({ page }) => {
    await withLoader(page);
    const outcomes = await page.evaluate(async () => {
      const m = await (window as unknown as W).__load('/src/application/googleAuthService.ts');
      const scope = encodeURIComponent(m.DRIVE_SCOPE);
      const attempt = (query: string) => {
        try {
          return `ok:${m.parseDesktopRedirect(query, 'expected-state')}`;
        } catch (error) {
          return `${(error as Error).name}:${(error as Error).message}`;
        }
      };
      return [
        attempt(`state=expected-state&code=abc123&scope=${scope}`),
        attempt(`state=attacker-state&code=abc123&scope=${scope}`),
        attempt('state=expected-state&error=access_denied'),
        attempt('state=expected-state&code=abc123&scope=email'),
        attempt('state=expected-state'),
      ];
    });
    expect(outcomes[0]).toBe('ok:abc123');
    expect(outcomes[1]).toContain('did not match');
    expect(outcomes[2]).toContain('GoogleSignInCancelledError');
    expect(outcomes[3]).toContain('Drive access was not granted');
    expect(outcomes[4]).toContain('no authorization code');
  });

  test('A "__proto__" key from restored JSON cannot change a record prototype', async ({ page }) => {
    await withLoader(page);
    const result = await page.evaluate(async (pass) => {
      const w = window as unknown as W;
      const vault = await w.__load('/src/security/vaultKeyService.ts');
      const { db } = await w.__load('/src/infrastructure/database/db.ts');
      await vault.initializeVault(pass);
      const row = JSON.parse(
        '{"id":"doc-proto","ownerId":"local-profile","title":"Proto test","category":"other","sensitivity":"normal",' +
        '"tags":[],"createdAt":"2026-10-01T00:00:00Z","updatedAt":"2026-10-01T00:00:00Z","__proto__":{"polluted":true}}',
      );
      await db.documents.put(row);
      const back = await db.documents.get('doc-proto');
      return {
        title: back?.title,
        normalPrototype: Object.getPrototypeOf(back) === Object.prototype,
        rowPolluted: (back as Record<string, unknown>)?.polluted,
        globalPolluted: ({} as Record<string, unknown>).polluted,
      };
    }, PASS);
    expect(result).toEqual({ title: 'Proto test', normalPrototype: true, rowPolluted: undefined, globalPolluted: undefined });
  });

  test('Opening the file picker does not lock the vault; real backgrounding still does', async ({ page }) => {
    await onboardAndUnlock(page);
    await page.locator('button:has-text("Settings")').first().click();

    // A click on a file input (camera / picker) marks an app-started flow.
    await page.evaluate(() => {
      const input = document.querySelector('input[type="file"]');
      if (!input) throw new Error('no file input on the Settings page');
      input.addEventListener('click', (e) => e.preventDefault(), { once: true });
      input.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await setHidden(page, true);
    await page.waitForTimeout(300);
    await expect(page.locator('input#vaultPassphrase')).toHaveCount(0);

    // Returning to the app clears the mark; the next backgrounding locks.
    await setHidden(page, false);
    await setHidden(page, true);
    await expect(page.locator('input#vaultPassphrase')).toBeVisible({ timeout: 5000 });
  });
});

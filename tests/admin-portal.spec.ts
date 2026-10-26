import { test, expect, type Page, type Download } from '@playwright/test';
import { generateKeyPairSync, sign } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const ADMIN_TOOL_PATH = path.resolve('tools/admin.html');
const ADMIN_TOOL_URL = `http://localhost:${process.env.PLAYWRIGHT_PORT ?? '5173'}/__test__/admin.html`;

function makeKeyPair() {
  const { publicKey, privateKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'der' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  return { spki: publicKey.toString('base64'), pem: privateKey };
}

/** Signs a key the same way the Apps Script mailer does. */
function makeLicense(pem: string, payload: Record<string, unknown>) {
  const json = JSON.stringify(payload);
  const sig = sign('sha256', Buffer.from(json, 'utf8'), pem).toString('base64url');
  return `MLD-PRO-${Buffer.from(json, 'utf8').toString('base64')}.${sig}`;
}

/** Serves tools/admin.html, optionally trusting a test public key instead of the real one. */
async function openAdminTool(page: Page, trustedSpki?: string) {
  let html = readFileSync(ADMIN_TOOL_PATH, 'utf8');
  if (trustedSpki) {
    html = html.replace(/const LICENSE_PUBLIC_KEY_SPKI = "[^"]*";/, `const LICENSE_PUBLIC_KEY_SPKI = "${trustedSpki}";`);
  }
  await page.route(ADMIN_TOOL_URL, (route) => route.fulfill({ contentType: 'text/html', body: html }));
  await page.goto(ADMIN_TOOL_URL);
}

async function loadKey(page: Page, pem: string) {
  await page.setInputFiles('#signing-key-file', { name: 'key.pem', mimeType: 'application/x-pem-file', buffer: Buffer.from(pem) });
  await page.click('#login-form button[type="submit"]');
}

const tab = (page: Page, name: string) => page.getByRole('tab', { name }).click();

async function downloadedText(download: Download) {
  const chunks: Buffer[] = [];
  for await (const chunk of await download.createReadStream()) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString('utf8');
}

test.describe('Founder Admin Tool (local-only, key-based signing)', () => {
  test('Admin portal is not served by the app or bundled into public/', async ({ page }) => {
    await page.goto('/admin.html');
    await expect(page.locator('#login-view')).toHaveCount(0);
    await expect(page.locator('text=Founder Administration')).toHaveCount(0);
  });

  test('No hardcoded passcode, shared secret, fake data or network access in the tool', () => {
    const html = readFileSync(ADMIN_TOOL_PATH, 'utf8');
    expect(html).not.toContain('MLD-Founder-2026!');
    expect(html).not.toContain('mld_vault_sovereign_signature_2026_secure');
    expect(html).not.toContain('localStorage.setItem');
    expect(html).not.toContain('FOUNDER50');
    expect(html).toContain("connect-src 'none'");
    expect(html).not.toMatch(/\bfetch\(|XMLHttpRequest|sendBeacon|WebSocket/);
  });

  test('Rejects a private key that does not match the app public key', async ({ page }) => {
    await openAdminTool(page);
    await loadKey(page, makeKeyPair().pem);
    await expect(page.locator('#toast')).toContainText('does not match');
    await expect(page.locator('#admin-view')).toBeHidden();
  });

  test('Without a key, the dashboard opens but cannot issue keys', async ({ page }) => {
    await openAdminTool(page);
    await page.click('button:has-text("Continue without key")');
    await expect(page.locator('#admin-view')).toBeVisible();
    await expect(page.locator('#key-chip')).toHaveText('View only');

    await tab(page, 'Issue key');
    await page.fill('#gen-name', 'No Key');
    await page.fill('#gen-email', 'nokey@example.com');
    await page.click('#tab-generator button[type="submit"]');
    await expect(page.locator('#toast')).toContainText('Load your signing key');
    await expect(page.locator('#gen-result')).toBeHidden();
  });

  test('Key Inspector rejects a forged key in the old HMAC format', async ({ page }) => {
    await openAdminTool(page);
    await page.click('button:has-text("Continue without key")');
    await tab(page, 'Inspect key');
    const forged = 'MLD-PRO-' + Buffer.from(JSON.stringify({ tier: 'pro_lifetime', email: 'x@y.z' })).toString('base64') + '.a9f148b598dc4e83f2a1b7e45693d2c1';
    await page.fill('#inspect-input', forged);
    await page.click('#inspect-btn');
    await expect(page.locator('#inspect-status-banner')).toContainText('INVALID');
  });

  test('A key issued by the tool verifies in the app, and its inspector accepts it', async ({ page }) => {
    const { spki, pem } = makeKeyPair();
    await openAdminTool(page, spki);
    await loadKey(page, pem);
    await expect(page.locator('#admin-view')).toBeVisible();
    await expect(page.locator('#key-chip')).toHaveText('Signing key loaded');

    await tab(page, 'Issue key');
    await page.fill('#gen-name', 'Ünïcode Customer');
    await page.fill('#gen-email', 'buyer@example.com');
    await page.selectOption('#gen-tier', 'pro_yearly');
    await expect(page.locator('#gen-amount')).toHaveValue('250');
    await page.click('#tab-generator button[type="submit"]');
    const licenseKey = (await page.locator('#gen-key-display').innerText()).trim();
    expect(licenseKey).toMatch(/^MLD-PRO-/);
    await expect(page.locator('#gen-mailto')).toHaveAttribute('href', /^mailto:buyer%40example\.com\?subject=/);

    await tab(page, 'Inspect key');
    await page.fill('#inspect-input', licenseKey);
    await page.click('#inspect-btn');
    await expect(page.locator('#inspect-status-banner')).toHaveText('VALID and active');
    await expect(page.locator('#inspect-details')).toContainText('buyer@example.com');

    // Cross-check with the app's own verifier.
    await page.goto('/');
    const status = await page.evaluate(async ([key, trusted]) => {
      const modPath = '/src/application/licenseService.ts';
      const mod = await import(/* @vite-ignore */ modPath);
      return mod.verifyLicenseKeyWithKeys(key, [trusted]);
    }, [licenseKey, spki]);
    expect(status.isValid).toBe(true);
    expect(status.tier).toBe('pro_yearly');
  });

  test('Custom duration: the amount is not replaced by the number of days, and expiry matches', async ({ page }) => {
    const { spki, pem } = makeKeyPair();
    await openAdminTool(page, spki);
    await loadKey(page, pem);
    await tab(page, 'Issue key');
    await page.selectOption('#gen-tier', 'custom');
    await page.fill('#gen-days', '45');
    await expect(page.locator('#gen-amount')).toHaveValue('0');
    await page.fill('#gen-name', 'Reviewer');
    await page.fill('#gen-email', 'reviewer@example.com');
    await page.click('#tab-generator button[type="submit"]');
    const key = (await page.locator('#gen-key-display').innerText()).trim();
    const payload = JSON.parse(Buffer.from(key.slice(8).split('.')[0], 'base64').toString('utf8'));
    expect((new Date(payload.expiresAt).getTime() - Date.now()) / 864e5).toBeCloseTo(45, 1);
  });

  test('Imports the Orders sheet CSV: real keys counted, forged keys flagged, renewals listed, safe export', async ({ page }) => {
    const { spki, pem } = makeKeyPair();
    const day = 864e5;
    const soon = new Date(Date.now() + 5 * day).toISOString();
    const later = new Date(Date.now() + 200 * day).toISOString();
    const lifetime = makeLicense(pem, { tier: 'pro_lifetime', email: 'life@example.com', issuedAt: new Date().toISOString() });
    const monthly = makeLicense(pem, { tier: 'pro_monthly', email: 'month@example.com', issuedAt: new Date().toISOString(), expiresAt: soon });
    const yearly = makeLicense(pem, { tier: 'pro_yearly', email: 'year@example.com', issuedAt: new Date().toISOString(), expiresAt: later });
    const forged = makeLicense(makeKeyPair().pem, { tier: 'pro_lifetime', email: 'evil@example.com', issuedAt: new Date().toISOString() });
    const csv = [
      'Timestamp,Customer Name,Customer Email,Amount (INR),Plan,License Key,Payment ID,Phone',
      `2026-10-01T10:00:00.000Z,"Rao, Asha",life@example.com,999,MyLifeDock Pro Lifetime,${lifetime},pay_A,'+919876543210`,
      `2026-10-02T10:00:00.000Z,=cmd|' /C calc'!A0,month@example.com,25,"MyLifeDock Pro (Monthly, 30 days)",${monthly},pay_B,`,
      `2026-10-03T10:00:00.000Z,Yash,year@example.com,250,"MyLifeDock Pro (Yearly, 365 days)",${yearly},pay_C,`,
      `2026-10-04T10:00:00.000Z,Evil,evil@example.com,1,Lifetime,${forged},pay_D,`,
      `2026-10-04T10:00:00.000Z,Evil,evil@example.com,1,Lifetime,${forged},pay_D,`,
    ].join('\r\n');

    await openAdminTool(page, spki);
    await page.click('button:has-text("Continue without key")');
    await page.setInputFiles('#orders-file', { name: 'orders.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
    await expect(page.locator('#toast')).toContainText('Imported 4 orders; 1 with an invalid key');

    await expect(page.locator('#kpi-orders')).toHaveText('4');
    await expect(page.locator('#kpi-revenue')).toHaveText('₹1,275');
    await expect(page.locator('#kpi-active')).toHaveText('3');
    await expect(page.locator('#kpi-lifetime')).toHaveText('1');
    await expect(page.locator('#renewals-tbody tr')).toHaveCount(1);
    await expect(page.locator('#renewals-tbody')).toContainText('month@example.com');
    await expect(page.locator('#renewals-tbody a')).toHaveAttribute('href', /buy\.html%3Fplan%3Dpro_monthly/);

    await tab(page, 'Orders');
    await expect(page.locator('#orders-tbody')).toContainText('Rao, Asha');
    await expect(page.locator('#orders-tbody')).toContainText('+919876543210');
    await page.selectOption('#filter-status', 'invalid');
    await expect(page.locator('#orders-tbody tr')).toHaveCount(1);
    await expect(page.locator('#orders-tbody')).toContainText('evil@example.com');

    const [download] = await Promise.all([page.waitForEvent('download'), page.click('#export-csv')]);
    const exported = await downloadedText(download);
    expect(exported).toContain('"Rao, Asha"');
    expect(exported).toContain(`"'=cmd|' /C calc'!A0"`);
    expect(exported).not.toMatch(/,=cmd/);

    // Locking clears imported orders from memory.
    await page.click('#lock');
    await page.click('button:has-text("Continue without key")');
    await expect(page.locator('#kpi-orders')).toHaveText('0');
  });

  test('Old browser data from earlier versions can be downloaded and removed', async ({ page }) => {
    await openAdminTool(page);
    await page.evaluate(() => {
      localStorage.setItem('mld_admin_licenses', JSON.stringify([{ timestamp: '2026-01-01', name: 'Old', email: 'old@example.com', amount: 999, plan: 'pro_lifetime', key: 'MLD-PRO-x.y' }]));
      localStorage.setItem('mld_admin_coupons', '[]');
    });
    await page.click('button:has-text("Continue without key")');
    await expect(page.locator('#legacy-notice')).toBeVisible();
    await expect(page.locator('#legacy-count')).toHaveText('1');
    const [download] = await Promise.all([page.waitForEvent('download'), page.click('#legacy-download')]);
    expect(await downloadedText(download)).toContain('old@example.com');
    page.once('dialog', (d) => d.accept());
    await page.click('#legacy-remove');
    await expect(page.locator('#legacy-notice')).toBeHidden();
    expect(await page.evaluate(() => localStorage.getItem('mld_admin_licenses'))).toBeNull();
  });
});

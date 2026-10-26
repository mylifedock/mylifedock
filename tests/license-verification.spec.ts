import { test, expect, type Page } from '@playwright/test';
import { generateKeyPairSync } from 'node:crypto';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { generateLicenseKey } = require('../scripts/generate-license.cjs');

const { publicKey, privateKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'der' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});
const TEST_SPKI = publicKey.toString('base64');

function nodeLicense(tier: string, durationDays?: number) {
  return generateLicenseKey({ email: 'buyer@example.com', tier, durationDays, privateKeyPem: privateKey }).licenseKey as string;
}

async function verify(page: Page, license: string, keys: string[] | 'build') {
  return page.evaluate(async ([lic, k]) => {
    const modPath = '/src/application/licenseService.ts';
    const mod = await import(/* @vite-ignore */ modPath);
    return k === 'build' ? mod.verifyLicenseKey(lic) : mod.verifyLicenseKeyWithKeys(lic, k);
  }, [license, keys] as const);
}

test.describe('License verification (RSASSA-PKCS1-v1_5 / SHA-256)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('Rejects the previously accepted forged key format (any 16+ char signature)', async ({ page }) => {
    const payload = Buffer.from(JSON.stringify({ tier: 'pro_lifetime', email: 'attacker@example.com' })).toString('base64');
    const forged = `MLD-PRO-${payload}.mock_signature_valid_for_dev_only_123456789`;
    const status = await verify(page, forged, 'build');
    expect(status.isValid).toBe(false);
    expect(status.tier).toBe('free_core');
  });

  test('Rejects old HMAC keys with a support message', async ({ page }) => {
    const payload = Buffer.from(JSON.stringify({ tier: 'pro_lifetime' })).toString('base64');
    const status = await verify(page, `MLD-PRO-${payload}.a9f148b598dc4e83f2a1b7e45693d2c1`, 'build');
    expect(status.isValid).toBe(false);
    expect(status.message).toContain('retired format');
  });

  test('Accepts keys from the Node CLI generator signed by a trusted key', async ({ page }) => {
    const lifetime = await verify(page, nodeLicense('lifetime'), [TEST_SPKI]);
    expect(lifetime).toMatchObject({ isValid: true, tier: 'pro_lifetime', email: 'buyer@example.com' });

    const yearly = await verify(page, nodeLicense('yearly'), [TEST_SPKI]);
    expect(yearly).toMatchObject({ isValid: true, tier: 'pro_yearly' });
  });

  test('Accepts the Apps Script signature encoding (base64 web-safe with padding)', async ({ page }) => {
    const key = nodeLicense('monthly');
    const [body, sig] = key.split('.');
    const padded = sig + '='.repeat((4 - (sig.length % 4)) % 4);
    const status = await verify(page, `${body}.${padded}`, [TEST_SPKI]);
    expect(status).toMatchObject({ isValid: true, tier: 'pro_monthly' });
  });

  test('Does not trust keys signed by an unknown private key', async ({ page }) => {
    const status = await verify(page, nodeLicense('lifetime'), 'build');
    expect(status.isValid).toBe(false);
  });

  test('Rejects a tampered payload (monthly upgraded to lifetime)', async ({ page }) => {
    const [, sig] = nodeLicense('monthly').split('.');
    const tamperedPayload = Buffer.from(JSON.stringify({ tier: 'pro_lifetime', email: 'buyer@example.com', issuedAt: new Date().toISOString() })).toString('base64');
    const status = await verify(page, `MLD-PRO-${tamperedPayload}.${sig}`, [TEST_SPKI]);
    expect(status.isValid).toBe(false);
  });

  test('Rejects an expired subscription even with a valid signature', async ({ page }) => {
    const expired = generateLicenseKey({ email: 'old@example.com', tier: 'monthly', durationDays: -1, privateKeyPem: privateKey }).licenseKey;
    const status = await verify(page, expired, [TEST_SPKI]);
    expect(status.isValid).toBe(false);
    expect(status.message).toContain('expired');
  });

  test('A forged key in localStorage does not lift the free vault quota', async ({ page }) => {
    const payload = Buffer.from(JSON.stringify({ tier: 'pro_lifetime' })).toString('base64');
    const quota = await page.evaluate(async (forged) => {
      localStorage.setItem('mld_pro_license', forged);
      const modPath = '/src/application/vaultLimitService.ts';
      const mod = await import(/* @vite-ignore */ modPath);
      const status = await mod.getVaultQuotaStatus();
      localStorage.removeItem('mld_pro_license');
      return { isPro: status.isPro, limit: status.limit };
    }, `MLD-PRO-${payload}.mock_signature_valid_for_dev_only_123456789`);
    expect(quota.isPro).toBe(false);
    expect(quota.limit).toBe(10);
  });
});

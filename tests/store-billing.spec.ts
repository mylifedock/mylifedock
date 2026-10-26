import { test, expect } from '@playwright/test';

// Google Play Billing / Apple In-App Purchase entitlement rules. The native
// plugin is not available in a browser, so these exercise the decision logic
// with store-shaped transactions.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Loose = any;
type W = { __load: (p: string) => Promise<Loose> };

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    (window as unknown as W).__load = (p: string) => import(/* @vite-ignore */ p);
  });
});

test('Which store transactions unlock Pro', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const billing = await (window as unknown as W).__load('/src/application/storeBillingService.ts');
    const now = Date.parse('2026-10-26T12:00:00Z');
    const tier = (txs: Loose[], platform: 'android' | 'ios') => billing.entitlementFrom(txs, platform, now)?.tier ?? 'free';
    return {
      androidLifetime: tier([{ productIdentifier: 'mylifedock.pro.lifetime', purchaseState: '1' }], 'android'),
      androidPending: tier([{ productIdentifier: 'mylifedock.pro.lifetime', purchaseState: '0' }], 'android'),
      androidMonthly: tier([{ productIdentifier: 'mylifedock.pro.monthly', purchaseState: '1' }], 'android'),
      unknownProduct: tier([{ productIdentifier: 'someone.elses.product', purchaseState: '1' }], 'android'),
      iosActiveSub: tier([{ productIdentifier: 'mylifedock.pro.yearly', subscriptionState: 'subscribed' }], 'ios'),
      iosGrace: tier([{ productIdentifier: 'mylifedock.pro.monthly', subscriptionState: 'inGracePeriod' }], 'ios'),
      iosExpired: tier([{ productIdentifier: 'mylifedock.pro.monthly', subscriptionState: 'expired', expirationDate: '2026-09-01T00:00:00Z' }], 'ios'),
      iosRefunded: tier([{ productIdentifier: 'mylifedock.pro.lifetime', revocationDate: '2026-10-01T00:00:00Z' }], 'ios'),
      iosLifetime: tier([{ productIdentifier: 'mylifedock.pro.lifetime' }], 'ios'),
      bestOfMany: tier([
        { productIdentifier: 'mylifedock.pro.monthly', purchaseState: '1' },
        { productIdentifier: 'mylifedock.pro.lifetime', purchaseState: '1' },
        { productIdentifier: 'mylifedock.pro.yearly', purchaseState: '1' },
      ], 'android'),
    };
  });
  expect(result).toEqual({
    androidLifetime: 'pro_lifetime',
    androidPending: 'free',
    androidMonthly: 'pro_monthly',
    unknownProduct: 'free',
    iosActiveSub: 'pro_yearly',
    iosGrace: 'pro_monthly',
    iosExpired: 'free',
    iosRefunded: 'free',
    iosLifetime: 'pro_lifetime',
    bestOfMany: 'pro_lifetime',
  });
});

test('A store purchase grants Pro in memory only; editing storage cannot fake it', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const w = window as unknown as W;
    const license = await w.__load('/src/application/licenseService.ts');
    const before = (await license.getLicenseStatus()).tier;
    license.setStoreEntitlement({ tier: 'pro_yearly', isValid: true, message: 'Pro subscription active' });
    const during = await license.getLicenseStatus();
    const stored = Object.keys(localStorage).filter((k) => /store|entitle/i.test(k));
    license.setStoreEntitlement(null);
    const after = (await license.getLicenseStatus()).tier;
    return { before, during: [during.tier, license.isProLicense(during)], stored, after };
  });
  expect(result).toEqual({ before: 'free_core', during: ['pro_yearly', true], stored: [], after: 'free_core' });
});

test('Checkout channel: the browser/desktop build sells through Razorpay, never store billing', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const w = window as unknown as W;
    const policy = await w.__load('/src/config/storePolicy.ts');
    const billing = await w.__load('/src/application/storeBillingService.ts');
    return {
      channel: policy.getCheckoutChannel(),
      razorpay: policy.isExternalCheckoutAllowed(),
      storeBilling: billing.isStoreBillingAvailable(),
      storePending: billing.isStoreBillingPending(),
    };
  });
  expect(result).toEqual({ channel: 'razorpay', razorpay: true, storeBilling: false, storePending: false });
});

import { test, expect, type Page } from '@playwright/test';

/**
 * Website pricing and checkout (docs/landing.html, docs/buy.html, docs/assets/pricing.js)
 * and the Windows app's live-price parser. The pricing service (Apps Script) and
 * Razorpay Checkout are simulated; no real payment is made.
 */
const API = 'https://script.google.com/macros/s/TEST_DEPLOYMENT/exec';
const CORS = { 'Access-Control-Allow-Origin': '*' };
const inDays = (n: number) => new Date(Date.now() + n * 864e5 + 5.5 * 36e5).toISOString().slice(0, 10);

const LIVE = {
  ok: true,
  currency: 'INR',
  plans: {
    pro_monthly: { label: 'Monthly Pro', priceINR: 25, priceUSD: 0.49, offer: null },
    pro_yearly: { label: 'Yearly Pro', priceINR: 250, priceUSD: 4.99, offer: null },
    pro_lifetime: { label: 'Lifetime', priceINR: 999, priceUSD: 19.99, offer: { priceINR: 699, priceUSD: 13.99, text: 'Diwali offer', endsOn: inDays(10) } },
  },
};

type Hooks = { pricing?: unknown; pricingStatus?: number; order?: unknown; configured?: boolean };

/** Points the page at the simulated pricing service and stubs Razorpay Checkout. */
async function setup(page: Page, { pricing = LIVE, pricingStatus = 200, order, configured = true }: Hooks = {}) {
  const orderRequests: string[] = [];
  if (configured) await page.addInitScript((api) => ((window as unknown as { MLD_PRICING_API_URL: string }).MLD_PRICING_API_URL = api), API);
  await page.route(`${API}?**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.get('action') === 'pricing') {
      return route.fulfill({ status: pricingStatus, headers: CORS, contentType: 'application/json', body: JSON.stringify(pricing) });
    }
    orderRequests.push(url.searchParams.get('plan') ?? '');
    return route.fulfill({
      headers: CORS,
      contentType: 'application/json',
      body: JSON.stringify(order ?? { ok: true, orderId: 'order_TEST1', amount: 69900, currency: 'INR', keyId: 'rzp_test_KEY', plan: 'pro_lifetime', label: 'Lifetime', description: 'MyLifeDock Pro Lifetime · Diwali offer' }),
    });
  });
  await page.route('https://checkout.razorpay.com/v1/checkout.js', (route) =>
    route.fulfill({
      contentType: 'application/javascript',
      body: `window.Razorpay = function (opts) {
        window.__rzp = { options: opts, handlers: {} };
        this.on = function (event, cb) { window.__rzp.handlers[event] = cb; };
        this.open = function () { window.__rzp.opened = true; };
      };`,
    }),
  );
  return { orderRequests };
}

test.describe('Website pricing from the Pricing tab', () => {
  test('Home page shows live prices, the offer and a banner; the currency switch keeps them', async ({ page }) => {
    await setup(page);
    await page.goto('/docs/landing.html');
    const lifetime = page.locator('[data-plan-price="pro_lifetime"]');
    await expect(lifetime).toHaveText('₹699');
    await expect(page.locator('[data-plan-price="pro_yearly"]')).toHaveText('₹250');
    await expect(page.locator('[data-plan-offer="pro_lifetime"]')).toContainText('Diwali offer · was ₹999 · ends');
    await expect(page.locator('[data-plan-offer="pro_monthly"]')).toBeHidden();
    await expect(page.locator('#offer-bar')).toBeVisible();
    await expect(page.locator('#offer-bar')).toContainText('Diwali offer: Lifetime now ₹699');

    await page.click('[data-currency="USD"]');
    await expect(lifetime).toHaveText('$13.99');
    await expect(page.locator('[data-plan-offer="pro_lifetime"]')).toContainText('was $19.99');
    await expect(page.locator('#lifetime-buy-btn')).toHaveAttribute('href', 'buy.html?plan=pro_lifetime');
  });

  test('If the pricing service fails or sends junk, the built-in prices stay and no offer shows', async ({ page }) => {
    await setup(page, { pricingStatus: 500 });
    await page.goto('/docs/landing.html');
    await page.waitForTimeout(500);
    await expect(page.locator('[data-plan-price="pro_lifetime"]')).toHaveText('₹999');
    await expect(page.locator('#offer-bar')).toBeHidden();

    const junk = await page.context().newPage();
    await setup(junk, { pricing: { ok: true, plans: { pro_lifetime: { priceINR: -5, priceUSD: 'x' }, pro_yearly: { priceINR: 250, priceUSD: 4.99, offer: { priceINR: 300, priceUSD: 6, text: 'not cheaper' } } } } });
    await junk.goto('/docs/landing.html');
    await junk.waitForTimeout(500);
    await expect(junk.locator('[data-plan-price="pro_lifetime"]')).toHaveText('₹999');
    await expect(junk.locator('[data-plan-offer="pro_yearly"]')).toBeHidden();
    await expect(junk.locator('#offer-bar')).toBeHidden();
  });
});

test.describe('Website checkout (buy.html)', () => {
  test('Creates the order at the live price, opens Razorpay with it, and confirms the payment', async ({ page }) => {
    const { orderRequests } = await setup(page);
    await page.goto('/docs/buy.html?plan=pro_lifetime');
    await expect(page.locator('input[value="pro_lifetime"]')).toBeChecked();
    await expect(page.locator('[data-choice-price="pro_lifetime"] s')).toHaveText('₹999');
    await expect(page.locator('[data-choice-price="pro_lifetime"]')).toContainText('₹699');
    await expect(page.locator('#pay-btn')).toHaveText('Pay ₹699 securely');

    await page.click('#pay-btn');
    await expect(page.locator('#checkout-status')).toHaveText('Please enter your name.');
    await page.fill('#buyer-name', 'Asha Rao');
    await page.click('#pay-btn');
    await expect(page.locator('#checkout-status')).toContainText('accept the Terms');
    expect(orderRequests).toEqual([]);

    await page.check('#agree');
    await page.click('#pay-btn');
    await expect.poll(() => page.evaluate(() => (window as unknown as { __rzp?: { opened?: boolean } }).__rzp?.opened)).toBe(true);
    expect(orderRequests).toEqual(['pro_lifetime']);
    const options = await page.evaluate(() => {
      const o = (window as unknown as { __rzp: { options: Record<string, unknown> } }).__rzp.options;
      return { key: o.key, order_id: o.order_id, amount: o.amount, currency: o.currency, notes: o.notes, prefill: o.prefill };
    });
    expect(options).toEqual({ key: 'rzp_test_KEY', order_id: 'order_TEST1', amount: 69900, currency: 'INR', notes: { name: 'Asha Rao' }, prefill: { name: 'Asha Rao' } });

    await page.evaluate(() => (window as unknown as { __rzp: { options: { handler: (r: unknown) => void } } }).__rzp.options.handler({ razorpay_payment_id: 'pay_TEST42' }));
    await expect(page.locator('#checkout-success')).toBeVisible();
    await expect(page.locator('#payment-id')).toHaveText('pay_TEST42');
    await expect(page.locator('#checkout-form')).toBeHidden();
  });

  test('Plan switch updates the button; a failed payment explains that no money was taken', async ({ page }) => {
    await setup(page, { order: { ok: true, orderId: 'order_TEST2', amount: 25000, currency: 'INR', keyId: 'rzp_test_KEY', plan: 'pro_yearly', label: 'Yearly Pro', description: 'Yearly' } });
    await page.goto('/docs/buy.html?plan=pro_yearly');
    await expect(page.locator('#pay-btn')).toHaveText('Pay ₹250 securely');
    await page.check('input[value="pro_monthly"]');
    await expect(page.locator('#pay-btn')).toHaveText('Pay ₹25 securely');
    await page.check('input[value="pro_yearly"]');
    await page.fill('#buyer-name', 'Ravi');
    await page.check('#agree');
    await page.click('#pay-btn');
    await expect.poll(() => page.evaluate(() => !!(window as unknown as { __rzp?: unknown }).__rzp)).toBe(true);
    await page.evaluate(() => (window as unknown as { __rzp: { handlers: Record<string, (r: unknown) => void> } }).__rzp.handlers['payment.failed']({ error: { description: 'Card declined' } }));
    await expect(page.locator('#checkout-status')).toHaveText('Payment failed: Card declined. No money was taken; please try again.');
  });

  test('If the order cannot be created, it offers the backup Payment Page at the regular price', async ({ page }) => {
    await setup(page, { order: { ok: false, error: 'unavailable' } });
    await page.goto('/docs/buy.html?plan=pro_lifetime');
    await expect(page.locator('#pay-btn')).toHaveText('Pay ₹699 securely');
    await page.fill('#buyer-name', 'Asha');
    await page.check('#agree');
    await page.click('#pay-btn');
    const backup = page.locator('#checkout-status a');
    await expect(backup).toHaveAttribute('href', 'https://rzp.io/rzp/lT9C4JH4');
    await expect(backup).toHaveText('Pay the regular price (₹999) on Razorpay');
    await expect(page.locator('#checkout-status')).toContainText('for the offer price');
  });

  test('If the live pricing service cannot be reached, the page still sells through the backup Payment Pages', async ({ page }) => {
    await setup(page, { configured: false });
    await page.goto('/docs/buy.html?plan=pro_monthly&x=<script>');
    await expect(page.locator('input[value="pro_monthly"]')).toBeChecked();
    await expect(page.locator('#pay-btn')).toHaveText('Pay ₹25 securely');
    await page.fill('#buyer-name', 'Asha');
    await page.check('#agree');
    await page.click('#pay-btn');
    await expect(page.locator('#checkout-status a')).toHaveAttribute('href', 'https://rzp.io/rzp/DLxeq0Q');
  });
});

test.describe('Windows app live prices', () => {
  test('parseLivePricing keeps valid plans and drops bad prices and offers that are not cheaper', async ({ page }) => {
    await page.goto('/');
    const result = await page.evaluate(async () => {
      const modPath = '/src/application/livePricingService.ts';
      const mod = await import(/* @vite-ignore */ modPath);
      return {
        good: mod.parseLivePricing({
          ok: true,
          plans: {
            pro_monthly: { priceINR: 25, priceUSD: 0.49, offer: { priceINR: 30, priceUSD: 0.6, text: 'x' } },
            pro_yearly: { priceINR: 'free', priceUSD: 4.99 },
            pro_lifetime: { priceINR: 999, priceUSD: 19.99, offer: { priceINR: 699, priceUSD: 13.99, text: 'Diwali offer', endsOn: '2026-11-15' } },
            __proto__: { priceINR: 1, priceUSD: 1 },
            pro_hacked: { priceINR: 1, priceUSD: 1 },
          },
        }),
        notOk: mod.parseLivePricing({ ok: false, plans: {} }),
        empty: mod.parseLivePricing({ ok: true, plans: { pro_yearly: { priceINR: 0, priceUSD: 1 } } }),
        junk: mod.parseLivePricing('nope'),
        formatted: [mod.formatINR(1499), mod.formatUSD(13.9)],
      };
    });
    expect(result.good).toEqual({
      pro_monthly: { priceINR: 25, priceUSD: 0.49, offer: null },
      pro_lifetime: { priceINR: 999, priceUSD: 19.99, offer: { priceINR: 699, priceUSD: 13.99, text: 'Diwali offer', endsOn: '2026-11-15' } },
    });
    expect(result.notOk).toBeNull();
    expect(result.empty).toBeNull();
    expect(result.junk).toBeNull();
    expect(result.formatted).toEqual(['₹1,499', '$13.90']);
  });

  test('fetchLivePricing reads the service and returns null on failure or a non-https URL', async ({ page }) => {
    let fail = false;
    await page.route(`${API}?**`, (route) =>
      fail
        ? route.fulfill({ status: 503, headers: CORS, body: 'down' })
        : route.fulfill({ headers: CORS, contentType: 'application/json', body: JSON.stringify(LIVE) }),
    );
    await page.goto('/');
    const load = (url: string) =>
      page.evaluate(async (u) => {
        const modPath = '/src/application/livePricingService.ts';
        const mod = await import(/* @vite-ignore */ modPath);
        return mod.fetchLivePricing(u);
      }, url);
    expect((await load(API))?.pro_lifetime?.offer?.priceINR).toBe(699);
    fail = true;
    expect(await load(API)).toBeNull();
    expect(await load('http://script.google.com/macros/s/X/exec')).toBeNull();
  });
});

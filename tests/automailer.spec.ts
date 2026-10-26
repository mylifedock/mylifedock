import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { generateKeyPairSync, sign, verify } from 'node:crypto';
import vm from 'node:vm';
import path from 'node:path';

/**
 * Runs scripts/razorpay-auto-mailer.gs (Google Apps Script) in Node with the
 * Apps Script services stubbed: Sheets (orders + Pricing tab), cache, Razorpay API.
 */
const SCRIPT = readFileSync(path.resolve('scripts/razorpay-auto-mailer.gs'), 'utf8');
const { publicKey, privateKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});
const DAY = 864e5;
const ORDER_HEADERS = ['Timestamp', 'Customer Name', 'Customer Email', 'Amount (INR)', 'Plan', 'License Key', 'Payment ID', 'Phone'];

type Payment = Record<string, unknown>;
type Mail = { to: string; subject: string; body: string; opts: { htmlBody?: string } };
type Order = { id: string; amount: number; currency: string; notes: Record<string, string> };

function payment(id: string, rupees: number, extra: Payment = {}): Payment {
  return { id, status: 'captured', currency: 'INR', amount: rupees * 100, email: 'Buyer@Example.com', contact: '+919876543210', notes: { name: 'Asha' }, ...extra };
}

/** yyyy-MM-dd in India, offset by whole days from today. */
function indiaDate(offsetDays: number) {
  return new Date(Date.now() + offsetDays * DAY + 5.5 * 36e5).toISOString().slice(0, 10);
}

/**
 * standalone: the script was made at script.google.com (no active spreadsheet).
 * pricing: rows of the Pricing tab (header first), or undefined for "no tab yet".
 */
function runMailer(payments: Record<string, Payment>, { standalone = false, pricing }: { standalone?: boolean; pricing?: unknown[][] } = {}) {
  const rows: unknown[][] = [];
  let pricingRows: unknown[][] | null = pricing ? pricing.map((r) => [...r]) : null;
  const created: string[] = [];
  const mails: Mail[] = [];
  const orders = new Map<string, Order>();
  const orderRequests: Record<string, unknown>[] = [];
  const cache = new Map<string, string>();

  const sheet = {
    getLastRow: () => rows.length,
    appendRow: (r: unknown[]) => rows.push(r),
    getDataRange: () => ({ getValues: () => rows }),
    createTextFinder: (t: string) => ({ matchEntireCell: () => ({ findNext: () => (rows.some((r) => r.includes(t)) ? {} : null) }) }),
  };
  const pricingSheet = {
    getDataRange: () => ({ getValues: () => pricingRows ?? [] }),
    setFrozenRows: () => {},
    getRange: (row: number, col: number) => ({
      setValues: (values: unknown[][]) => values.forEach((v, i) => ((pricingRows ??= [])[row - 1 + i] = [...v])),
      setValue: (value: unknown) => {
        pricingRows ??= [];
        (pricingRows[row - 1] ??= [])[col - 1] = value;
      },
      setFontWeight: () => {},
      insertCheckboxes: () => {},
      setDataValidation: () => {},
    }),
  };
  const spreadsheet = {
    getSheets: () => (pricingRows ? [sheet, pricingSheet] : [sheet]),
    getSheetByName: (name: string) => (name === 'Pricing' && pricingRows ? pricingSheet : null),
    insertSheet: (name: string) => {
      expect(name).toBe('Pricing');
      pricingRows = [];
      return pricingSheet;
    },
    getId: () => 'sheet-123',
    getUrl: () => 'https://docs.google.com/spreadsheets/d/sheet-123',
  };
  const properties = new Map([
    ['RAZORPAY_KEY_ID', 'rzp_test'],
    ['RAZORPAY_KEY_SECRET', 'secret'],
    // Script Properties often lose the PEM's line breaks.
    ['MLD_LICENSE_PRIVATE_KEY', privateKey.replace(/\n/g, ' ')],
  ]);
  const validation = { requireDate: () => validation, setAllowInvalid: () => validation, build: () => ({}) };

  const context = vm.createContext({
    console,
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (n: string) => properties.get(n) ?? null,
        setProperty: (n: string, v: string) => properties.set(n, v),
      }),
    },
    CacheService: {
      getScriptCache: () => ({
        get: (k: string) => cache.get(k) ?? null,
        put: (k: string, v: string) => cache.set(k, v),
        remove: (k: string) => cache.delete(k),
      }),
    },
    ContentService: { MimeType: { JSON: 'json', TEXT: 'text' }, createTextOutput: (t: string) => ({ setMimeType: () => t }) },
    Utilities: {
      Charset: { UTF_8: 'utf8' },
      base64Encode: (s: string) => Buffer.from(s, 'utf8').toString('base64'),
      base64EncodeWebSafe: (b: number[]) => Buffer.from(b).toString('base64').replace(/\+/g, '-').replace(/\//g, '_'),
      computeRsaSha256Signature: (data: string, pem: string) => [...sign('sha256', Buffer.from(data, 'utf8'), pem)],
      formatDate: (d: Date, tz: string, fmt: string) => {
        expect([tz, fmt]).toEqual(['Asia/Kolkata', 'yyyy-MM-dd']);
        return new Date(d.getTime() + 5.5 * 36e5).toISOString().slice(0, 10);
      },
    },
    UrlFetchApp: {
      fetch: (url: string, opts: { method?: string; payload?: string } = {}) => {
        const reply = (body: unknown) => ({ getResponseCode: () => (body ? 200 : 404), getContentText: () => JSON.stringify(body) });
        const tail = url.replace('https://api.razorpay.com/v1/', '');
        if (tail === 'orders' && opts.method === 'post') {
          const body = JSON.parse(opts.payload ?? '{}');
          orderRequests.push(body);
          const order = { id: `order_T${orders.size + 1}`, amount: body.amount, currency: body.currency, notes: body.notes };
          orders.set(order.id, order);
          return reply(order);
        }
        if (tail.startsWith('orders/')) return reply(orders.get(tail.slice(7)) ?? null);
        if (tail.startsWith('payments/')) return reply(payments[tail.slice(9)] ?? null);
        return reply(null);
      },
    },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    SpreadsheetApp: {
      getActiveSpreadsheet: () => (standalone ? null : spreadsheet),
      create: (name: string) => {
        created.push(name);
        return spreadsheet;
      },
      openById: (id: string) => {
        if (id !== 'sheet-123') throw new Error('unknown spreadsheet');
        return spreadsheet;
      },
      newDataValidation: () => validation,
    },
    GmailApp: {
      sendEmail: (to: string, subject: string, body: string, opts: Mail['opts'] = {}) => mails.push({ to, subject, body, opts }),
    },
  });
  vm.runInContext(SCRIPT, context);
  const post = (id: string) =>
    JSON.parse(context.doPost({ postData: { contents: JSON.stringify({ event: 'payment.captured', payload: { payment: { entity: { id } } } }) } }));
  const get = (parameter: Record<string, string>) => JSON.parse(context.doGet({ parameter }));
  return {
    rows,
    mails,
    post,
    get,
    created,
    properties,
    orders,
    orderRequests,
    clearCache: () => cache.clear(),
    pricingRows: () => pricingRows,
    setup: () => context.setupOrdersSheet() as string,
  };
}

function decodeKey(key: string) {
  const [payloadB64, sig] = key.slice('MLD-PRO-'.length).split('.');
  const json = Buffer.from(payloadB64, 'base64').toString('utf8');
  const valid = verify('sha256', Buffer.from(json, 'utf8'), publicKey, Buffer.from(sig.replace(/-/g, '+').replace(/_/g, '/'), 'base64'));
  return { valid, payload: JSON.parse(json) as { tier: string; email: string; expiresAt?: string } };
}

const PRICING_HEADER = ['Plan ID (do not change)', 'Plan', 'Price ₹', 'Price $ (shown only)', 'Offer on', 'Offer price ₹', 'Offer text', 'Offer ends (last day)'];
function pricingTab(overrides: Partial<Record<'pro_monthly' | 'pro_yearly' | 'pro_lifetime', unknown[]>> = {}) {
  return [
    PRICING_HEADER,
    overrides.pro_monthly ?? ['pro_monthly', 'Monthly Pro', 25, 0.49, false, '', '', ''],
    overrides.pro_yearly ?? ['pro_yearly', 'Yearly Pro', 250, 4.99, false, '', '', ''],
    overrides.pro_lifetime ?? ['pro_lifetime', 'Lifetime', 999, 19.99, false, '', '', ''],
  ];
}

test.describe('Razorpay auto-mailer (Apps Script)', () => {
  test('Backup Payment Pages: the plan comes only from the verified amount, never from what the buyer typed', () => {
    const m = runMailer({
      pay_M1: payment('pay_M1', 25, { notes: { name: 'lifetime founder yearly', address: 'Lifetime Street' }, description: 'lifetime' }),
      pay_Y1: payment('pay_Y1', 250),
      pay_L1: payment('pay_L1', 999),
      pay_L2: payment('pay_L2', 1998),
      pay_T1: payment('pay_T1', 1),
    });
    for (const id of ['pay_M1', 'pay_Y1', 'pay_L1', 'pay_L2', 'pay_T1']) expect(m.post(id).status).toBe('success');

    const keys = m.rows.slice(1).map((r) => decodeKey(String(r[5])));
    expect(keys.every((k) => k.valid)).toBe(true);
    expect(keys.map((k) => k.payload.tier)).toEqual(['pro_monthly', 'pro_yearly', 'pro_lifetime', 'pro_lifetime', 'pro_monthly']);
    expect(keys[0].payload.email).toBe('buyer@example.com');
    expect(keys[2].payload.expiresAt).toBeUndefined();
    const days = (iso?: string) => (new Date(iso ?? 0).getTime() - Date.now()) / DAY;
    expect(days(keys[0].payload.expiresAt)).toBeCloseTo(30, 1);
    expect(days(keys[1].payload.expiresAt)).toBeCloseTo(365, 1);
    expect(days(keys[4].payload.expiresAt)).toBeCloseTo(3, 1);
    expect(m.rows[5][4]).toBe('MyLifeDock Pro (3-day test pass)');
  });

  test('One license per payment; unverified, unknown and foreign-currency payments issue nothing', () => {
    const m = runMailer({
      pay_A1: payment('pay_A1', 25),
      pay_P1: payment('pay_P1', 999, { status: 'authorized' }),
      pay_U1: payment('pay_U1', 10, { currency: 'USD' }),
    });
    expect(m.post('pay_A1').status).toBe('success');
    expect(m.post('pay_A1').reason).toBe('already processed');
    expect(m.post('pay_P1').reason).toBe('payment not verified as captured');
    expect(m.post('pay_ZZ').reason).toBe('payment not verified as captured');
    expect(m.post('order_123').reason).toBe('no payment id');
    expect(m.post('pay_U1').reason).toBe('non-INR payment flagged for manual review');
    expect(m.rows).toHaveLength(2);
    expect(m.mails.filter((x) => x.to === 'Buyer@Example.com')).toHaveLength(1);
    expect(m.mails.some((x) => x.subject.includes('Manual license needed'))).toBe(true);
  });

  test('A standalone script (no attached Sheet) creates the Orders sheet once and still issues licenses', () => {
    const m = runMailer({ pay_S1: payment('pay_S1', 999), pay_S2: payment('pay_S2', 25) }, { standalone: true });
    expect(m.post('pay_S1').status).toBe('success');
    expect(m.post('pay_S1').reason).toBe('already processed');
    expect(m.post('pay_S2').status).toBe('success');
    expect(m.created).toEqual(['MyLifeDock Orders']);
    expect(m.properties.get('ORDERS_SHEET_ID')).toBe('sheet-123');
    expect(m.rows).toHaveLength(3);
    expect(m.mails.filter((x) => x.to === 'Buyer@Example.com')).toHaveLength(2);
    expect(m.setup()).toBe('https://docs.google.com/spreadsheets/d/sheet-123');
    expect(m.created).toHaveLength(1);
  });

  test('setupOrdersSheet adds the order header row and a Pricing tab with the regular prices, once', () => {
    const m = runMailer({});
    m.setup();
    expect(m.rows).toEqual([ORDER_HEADERS]);
    const tab = m.pricingRows() ?? [];
    expect(tab.slice(0, 4)).toEqual(pricingTab());
    expect(String(tab[5][0])).toContain('Offer on');

    tab[3][2] = 1499; // the founder edits the sheet
    m.setup();
    expect((m.pricingRows() ?? [])[3][2]).toBe(1499);
    expect(m.rows).toHaveLength(1);
  });

  test('Sheet row has name and phone from the payment; typed formulas are stored as text', () => {
    const m = runMailer({ pay_N1: payment('pay_N1', 25, { notes: { customer_full_name: '=HYPERLINK("http://x","y")' } }) });
    m.post('pay_N1');
    expect(m.rows[0]).toEqual(ORDER_HEADERS);
    expect(m.rows[1][1]).toBe('\'=HYPERLINK("http://x","y")');
    expect(m.rows[1][7]).toBe("'+919876543210");
    expect(m.rows[1][6]).toBe('pay_N1');
    const html = m.mails[0].opts.htmlBody ?? '';
    expect(html).toContain('Settings &amp; Backup');
    expect(html).not.toContain('"http://x"');
  });
});

test.describe('Pricing tab: one place for prices and offers', () => {
  test('?action=pricing serves the Pricing tab; offers apply only when on, cheaper and not ended', () => {
    const m = runMailer({}, {
      pricing: pricingTab({
        pro_monthly: ['pro_monthly', 'Monthly Pro', 29, 0.59, true, 29, 'Not cheaper', ''], // offer not below price: ignored
        pro_yearly: ['pro_yearly', 'Yearly Pro', 'abc', -1, true, 199, 'Ended', new Date(Date.now() - 2 * DAY)], // bad price: default; offer ended
        pro_lifetime: ['pro_lifetime', 'Lifetime', 999, 19.99, true, 699, 'Diwali offer', indiaDate(0)], // ends today: still on
      }),
    });
    const res = m.get({ action: 'pricing' });
    expect(res.ok).toBe(true);
    expect(res.plans.pro_monthly).toEqual({ label: 'Monthly Pro', priceINR: 29, priceUSD: 0.59, offer: null });
    expect(res.plans.pro_yearly).toEqual({ label: 'Yearly Pro', priceINR: 250, priceUSD: 4.99, offer: null });
    expect(res.plans.pro_lifetime.offer).toEqual({ priceINR: 699, priceUSD: 13.99, text: 'Diwali offer', endsOn: indiaDate(0) });
  });

  test('Prices are cached for a minute, then the sheet edit shows', () => {
    const tab = pricingTab();
    const m = runMailer({}, { pricing: tab });
    expect(m.get({ action: 'pricing' }).plans.pro_lifetime.priceINR).toBe(999);
    (m.pricingRows() ?? [])[3][2] = 1299;
    expect(m.get({ action: 'pricing' }).plans.pro_lifetime.priceINR).toBe(999);
    m.clearCache(); // cache expiry
    expect(m.get({ action: 'pricing' }).plans.pro_lifetime.priceINR).toBe(1299);
  });

  test('Without a Pricing tab the regular default prices are served', () => {
    const res = runMailer({}).get({ action: 'pricing' });
    expect(Object.fromEntries(Object.entries(res.plans).map(([k, v]) => [k, (v as { priceINR: number }).priceINR]))).toEqual({ pro_monthly: 25, pro_yearly: 250, pro_lifetime: 999 });
  });

  test('?action=order creates the Razorpay order at the current (offer) price with the plan on the order', () => {
    const m = runMailer({}, { pricing: pricingTab({ pro_lifetime: ['pro_lifetime', 'Lifetime', 999, 19.99, true, 699, 'Diwali offer', indiaDate(5)] }) });
    const res = m.get({ action: 'order', plan: 'pro_lifetime' });
    expect(res).toMatchObject({ ok: true, orderId: 'order_T1', amount: 69900, currency: 'INR', keyId: 'rzp_test', plan: 'pro_lifetime', label: 'Lifetime' });
    expect(res.description).toContain('Diwali offer');
    expect(m.orderRequests[0]).toMatchObject({ amount: 69900, currency: 'INR', notes: { plan: 'pro_lifetime', source: 'mylifedock-website', price_inr: '699' } });
    expect(JSON.stringify(res)).not.toContain('secret');

    expect(m.get({ action: 'order', plan: 'pro_yearly' }).amount).toBe(25000);
    expect(m.get({ action: 'order', plan: 'pro_forever' })).toEqual({ ok: false, error: 'unknown plan' });
    expect(m.get({ action: 'order', plan: '__proto__' })).toEqual({ ok: false, error: 'unknown plan' });
  });

  test('Order creation is rate limited', () => {
    const m = runMailer({});
    for (let i = 0; i < 60; i++) expect(m.get({ action: 'order', plan: 'pro_monthly' }).ok).toBe(true);
    expect(m.get({ action: 'order', plan: 'pro_monthly' })).toEqual({ ok: false, error: 'busy' });
  });

  test('Website checkout: the license plan comes from the order, so offer prices give the right plan', () => {
    const m = runMailer(
      {
        pay_O1: payment('pay_O1', 699, { order_id: 'order_T1' }),
        pay_O2: payment('pay_O2', 25, { order_id: 'order_T2' }), // paid less than the order: falls back to amount
        pay_PP: payment('pay_PP', 250, { order_id: 'order_PAGE' }), // Payment Page's own order: amount rules
      },
      { pricing: pricingTab({ pro_lifetime: ['pro_lifetime', 'Lifetime', 999, 19.99, true, 699, 'Diwali offer', ''] }) },
    );
    m.get({ action: 'order', plan: 'pro_lifetime' });
    m.get({ action: 'order', plan: 'pro_yearly' });
    m.orders.set('order_PAGE', { id: 'order_PAGE', amount: 25000, currency: 'INR', notes: { plan: 'pro_lifetime' } });

    for (const id of ['pay_O1', 'pay_O2', 'pay_PP']) expect(m.post(id).status).toBe('success');
    const tiers = m.rows.slice(1).map((r) => decodeKey(String(r[5])).payload.tier);
    expect(tiers).toEqual(['pro_lifetime', 'pro_monthly', 'pro_yearly']);
    expect(m.rows[1][3]).toBe(699);
  });

  test('A raised price in the sheet still maps payments on the old backup Payment Page correctly', () => {
    const m = runMailer({ pay_L: payment('pay_L', 999), pay_Y: payment('pay_Y', 250) }, {
      pricing: pricingTab({
        pro_yearly: ['pro_yearly', 'Yearly Pro', 299, 5.99, false, '', '', ''],
        pro_lifetime: ['pro_lifetime', 'Lifetime', 1499, 29.99, false, '', '', ''],
      }),
    });
    m.post('pay_L');
    m.post('pay_Y');
    expect(m.rows.slice(1).map((r) => decodeKey(String(r[5])).payload.tier)).toEqual(['pro_lifetime', 'pro_yearly']);
  });
});

/**
 * =========================================================================
 * MYLIFEDOCK PRO: PRICING, CHECKOUT AND LICENSE MAILER (Google Apps Script, free)
 * =========================================================================
 *
 * ONE PLACE FOR PRICES: the "Pricing" tab of your MyLifeDock Orders sheet.
 * Change a price, or tick "Offer on", and within about a minute:
 *   - the website and the Windows app show the new price / offer
 *     (they read ?action=pricing from this script),
 *   - Razorpay charges that price (the website asks this script to create
 *     the Razorpay order: ?action=order&plan=...),
 *   - the license email gives the right plan (the plan is stored on the
 *     order by this script, so offers and price changes never confuse it).
 * Offers switch off by themselves after their "Offer ends" date.
 * Android and iPhone prices are set in Play Console / App Store Connect.
 *
 * LICENSES:
 * 1. Razorpay sends a "payment.captured" webhook to this script.
 * 2. The script re-fetches the payment from the Razorpay API and continues only
 *    if Razorpay confirms it as captured (Apps Script cannot read the
 *    X-Razorpay-Signature header, so the webhook body is never trusted).
 * 3. Plan: from the order this script created; for payments made on the backup
 *    Razorpay Payment Pages, from the amount (regular prices only).
 * 4. One license per payment ID: RSA-signed, logged in the sheet, emailed.
 *
 * SETUP (about 10 minutes):
 * 1. Paste this whole file into your Apps Script project and Save. (Paste it
 *    directly. Do not use a loader that downloads code.) A standalone project
 *    at script.google.com or one opened from a Sheet both work.
 * 2. Choose "setupOrdersSheet" next to Run, click Run and allow the permissions.
 *    The log prints the link of the "MyLifeDock Orders" sheet. It has the orders
 *    tab (first) and the Pricing tab.
 * 3. Project Settings -> Script Properties:
 *    - RAZORPAY_KEY_ID         : Razorpay Dashboard -> Account & Settings -> API Keys
 *    - RAZORPAY_KEY_SECRET     : same place; keep it secret
 *    - MLD_LICENSE_PRIVATE_KEY : the .pem from `node scripts/generate-license-keypair.cjs`
 * 4. Deploy -> New deployment -> Web app. Execute as: Me. Who has access: Anyone.
 *    (Updating: Deploy -> Manage deployments -> Edit -> Version: New version;
 *    the URL stays the same.) This URL goes in the website and the app.
 * 5. Razorpay -> Account & Settings -> Webhooks: the Web App URL, event "payment.captured".
 * 6. Test: <Web App URL>?action=pricing shows the prices as JSON; then buy the
 *    cheapest plan on the website and check the email and the new sheet row.
 * =========================================================================
 */

/**
 * Regular prices used until the Pricing tab exists, if it cannot be read, and
 * to fill it the first time. npm run release:check compares them with the app.
 */
var DEFAULT_PRICES_INR = { pro_monthly: 25, pro_yearly: 250, pro_lifetime: 999 };
var DEFAULT_PRICES_USD = { pro_monthly: 0.49, pro_yearly: 4.99, pro_lifetime: 19.99 };

var PLANS = {
  pro_monthly: { label: "Monthly Pro", days: 30, title: "MyLifeDock Pro (Monthly, 30 days)", validity: "30 days" },
  pro_yearly: { label: "Yearly Pro", days: 365, title: "MyLifeDock Pro (Yearly, 365 days)", validity: "1 year (365 days)" },
  pro_lifetime: { label: "Lifetime", days: null, title: "MyLifeDock Pro Lifetime", validity: "Lifetime, never expires" }
};
var TEST_PASS = { tier: "pro_monthly", days: 3, title: "MyLifeDock Pro (3-day test pass)", validity: "3 days (test)" };

var ORDER_HEADERS = ["Timestamp", "Customer Name", "Customer Email", "Amount (INR)", "Plan", "License Key", "Payment ID", "Phone"];
var PRICING_SHEET = "Pricing";
var PRICING_HEADERS = ["Plan ID (do not change)", "Plan", "Price ₹", "Price $ (shown only)", "Offer on", "Offer price ₹", "Offer text", "Offer ends (last day)"];
var ORDER_SOURCE = "mylifedock-website";
var TIME_ZONE = "Asia/Kolkata";
var PRICING_CACHE_KEY = "pricing:v1";
var PRICING_CACHE_SECONDS = 60;
var MAX_ORDERS_PER_MINUTE = 60;
var LIFETIME_MILESTONE = 15;
var FOUNDER_EMAIL = "mylifedock@gmail.com";

function getRequiredProperty(name) {
  var value = PropertiesService.getScriptProperties().getProperty(name);
  if (!value) {
    throw new Error("Missing Script Property: " + name);
  }
  return value;
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function truncate(value, max) {
  var s = value ? String(value) : "";
  return s.length > max ? s.substring(0, max) + "…" : s;
}

/**
 * Calls the Razorpay API with the account's keys. Returns the parsed JSON,
 * or null unless Razorpay answers 200.
 */
function razorpayRequest(method, path, body) {
  var auth = Utilities.base64Encode(getRequiredProperty("RAZORPAY_KEY_ID") + ":" + getRequiredProperty("RAZORPAY_KEY_SECRET"));
  var options = {
    method: method,
    headers: { Authorization: "Basic " + auth },
    muteHttpExceptions: true
  };
  if (body) {
    options.contentType = "application/json";
    options.payload = JSON.stringify(body);
  }
  var response = UrlFetchApp.fetch("https://api.razorpay.com/v1/" + path, options);
  if (response.getResponseCode() !== 200) {
    // Shown in Apps Script -> Executions (Razorpay's error text never contains the key secret).
    console.error("Razorpay " + method.toUpperCase() + " " + path.split("/")[0] + " failed: HTTP " +
      response.getResponseCode() + " " + truncate(response.getContentText(), 300));
    return null;
  }
  return JSON.parse(response.getContentText());
}

function fetchRazorpay(path) {
  return razorpayRequest("get", path);
}

// ---------------------------------------------------------------------------
// Sheets
// ---------------------------------------------------------------------------

/**
 * The orders spreadsheet. A script opened from a Sheet (Extensions -> Apps Script)
 * uses that Sheet. A standalone script (made at script.google.com) uses the Sheet
 * saved in the ORDERS_SHEET_ID Script Property, creating "MyLifeDock Orders" in
 * your Drive the first time.
 */
function getOrdersSpreadsheet() {
  var active = SpreadsheetApp.getActiveSpreadsheet();
  if (active) {
    return active;
  }
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty("ORDERS_SHEET_ID");
  if (id) {
    return SpreadsheetApp.openById(id);
  }
  var created = SpreadsheetApp.create("MyLifeDock Orders");
  props.setProperty("ORDERS_SHEET_ID", created.getId());
  return created;
}

/** The orders tab: the spreadsheet's first tab. */
function getOrdersSheet() {
  return getOrdersSpreadsheet().getSheets()[0];
}

/**
 * Run once from the Apps Script editor (choose "setupOrdersSheet" next to Run):
 * finds or creates the Orders sheet, adds the Pricing tab, and prints the link.
 */
function setupOrdersSheet() {
  var spreadsheet = getOrdersSpreadsheet();
  var sheet = spreadsheet.getSheets()[0];
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(ORDER_HEADERS);
  }
  setupPricingTab(spreadsheet);
  console.log("MyLifeDock Orders sheet: " + spreadsheet.getUrl());
  return spreadsheet.getUrl();
}

/** Creates the Pricing tab with the regular prices, unless it already exists. */
function setupPricingTab(spreadsheet) {
  if (spreadsheet.getSheetByName(PRICING_SHEET)) {
    return;
  }
  var sheet = spreadsheet.insertSheet(PRICING_SHEET, spreadsheet.getSheets().length);
  var rows = [PRICING_HEADERS];
  Object.keys(PLANS).forEach(function (id) {
    rows.push([id, PLANS[id].label, DEFAULT_PRICES_INR[id], DEFAULT_PRICES_USD[id], false, "", "", ""]);
  });
  sheet.getRange(1, 1, rows.length, PRICING_HEADERS.length).setValues(rows);
  sheet.getRange(1, 1, 1, PRICING_HEADERS.length).setFontWeight("bold");
  sheet.setFrozenRows(1);
  sheet.getRange(2, 5, 3, 1).insertCheckboxes();
  sheet.getRange(2, 8, 3, 1).setDataValidation(SpreadsheetApp.newDataValidation().requireDate().setAllowInvalid(false).build());
  sheet.getRange(6, 1).setValue(
    "Change a price or tick 'Offer on' (with an offer price below the regular price). The website and Windows app " +
    "update within a minute, and Razorpay charges the new price. Offers stop after 'Offer ends'. " +
    "Android/iPhone prices are set in Play Console / App Store Connect.");
  clearPricingCache();
}

/** True if a license was already issued for this Razorpay payment ID. */
function isPaymentAlreadyProcessed(paymentId) {
  return getOrdersSheet().createTextFinder(paymentId).matchEntireCell(true).findNext() !== null;
}

// ---------------------------------------------------------------------------
// Pricing (the Pricing tab)
// ---------------------------------------------------------------------------

function clearPricingCache() {
  try {
    CacheService.getScriptCache().remove(PRICING_CACHE_KEY);
  } catch (e) {
    console.error(e);
  }
}

function todayInIndia() {
  return Utilities.formatDate(new Date(), TIME_ZONE, "yyyy-MM-dd");
}

/** "Offer ends" cell: a date, or text like 2026-11-15. Returns yyyy-MM-dd or "". */
function endDateFrom(cell) {
  if (Object.prototype.toString.call(cell) === "[object Date]" && !isNaN(cell.getTime())) {
    return Utilities.formatDate(cell, TIME_ZONE, "yyyy-MM-dd");
  }
  var text = String(cell || "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : "";
}

function wholeRupees(value) {
  var n = Math.round(Number(value));
  return isFinite(n) && n >= 1 ? n : null;
}

/** Current prices per plan, from the Pricing tab (defaults for anything missing or invalid). */
function readPricing() {
  var pricing = {};
  Object.keys(PLANS).forEach(function (id) {
    pricing[id] = { label: PLANS[id].label, priceINR: DEFAULT_PRICES_INR[id], priceUSD: DEFAULT_PRICES_USD[id], offer: null };
  });

  var sheet = getOrdersSpreadsheet().getSheetByName(PRICING_SHEET);
  if (!sheet) {
    return pricing;
  }
  var today = todayInIndia();
  sheet.getDataRange().getValues().forEach(function (row) {
    var id = String(row[0] || "").trim();
    if (!Object.prototype.hasOwnProperty.call(PLANS, id)) {
      return;
    }
    var plan = pricing[id];
    plan.priceINR = wholeRupees(row[2]) || plan.priceINR;
    var usd = Math.round(Number(row[3]) * 100) / 100;
    if (isFinite(usd) && usd > 0) {
      plan.priceUSD = usd;
    }

    var offerOn = row[4] === true || String(row[4]).toUpperCase() === "TRUE";
    var offerPrice = wholeRupees(row[5]);
    var endsOn = endDateFrom(row[7]);
    if (offerOn && offerPrice && offerPrice < plan.priceINR && (!endsOn || today <= endsOn)) {
      plan.offer = {
        priceINR: offerPrice,
        priceUSD: Math.max(0.01, Math.round((plan.priceUSD * offerPrice / plan.priceINR) * 100) / 100),
        text: truncate(String(row[6] || "").trim(), 80) || "Limited-time offer",
        endsOn: endsOn
      };
    }
  });
  return pricing;
}

/** readPricing(), cached for a minute so the website stays fast. */
function getPricing() {
  var cache = null;
  try {
    cache = CacheService.getScriptCache();
    var cached = cache.get(PRICING_CACHE_KEY);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (e) {
    cache = null;
  }
  var pricing = readPricing();
  if (cache) {
    cache.put(PRICING_CACHE_KEY, JSON.stringify(pricing), PRICING_CACHE_SECONDS);
  }
  return pricing;
}

function chargeFor(planPricing) {
  return planPricing.offer ? planPricing.offer.priceINR : planPricing.priceINR;
}

/**
 * A usable customer email, or "". Razorpay's checkout can skip the email field
 * and then reports the placeholder void@razorpay.com.
 */
function cleanEmail(value) {
  var s = String(value || "").trim();
  if (s.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) || s.toLowerCase() === "void@razorpay.com") {
    return "";
  }
  return s;
}

/** Creates the Razorpay order for one plan at the current (offer) price. */
function createOrder(planId, email) {
  if (!Object.prototype.hasOwnProperty.call(PLANS, planId)) {
    return { ok: false, error: "unknown plan" };
  }
  var notes = { plan: planId, source: ORDER_SOURCE };
  var buyerEmail = cleanEmail(email);
  if (buyerEmail) {
    notes.email = buyerEmail;
  }

  // Simple abuse guard: order creation is public.
  var cache = CacheService.getScriptCache();
  var minuteKey = "orders:" + Math.floor(Date.now() / 60000);
  var count = Number(cache.get(minuteKey) || 0);
  if (count >= MAX_ORDERS_PER_MINUTE) {
    return { ok: false, error: "busy" };
  }
  cache.put(minuteKey, String(count + 1), 120);

  var planPricing = getPricing()[planId];
  var rupees = chargeFor(planPricing);
  notes.price_inr = String(rupees);
  var order = razorpayRequest("post", "orders", {
    amount: rupees * 100,
    currency: "INR",
    receipt: "mld_" + planId + "_" + Date.now(),
    notes: notes
  });
  if (!order || !order.id) {
    return { ok: false, error: "unavailable" };
  }
  return {
    ok: true,
    orderId: order.id,
    amount: order.amount,
    currency: order.currency,
    keyId: getRequiredProperty("RAZORPAY_KEY_ID"),
    plan: planId,
    label: PLANS[planId].label,
    description: PLANS[planId].title + (planPricing.offer ? " · " + planPricing.offer.text : "")
  };
}

// ---------------------------------------------------------------------------
// Web app entry points
// ---------------------------------------------------------------------------

/** Public GET: ?action=pricing (prices and offers) and ?action=order&plan=... (checkout). */
function doGet(e) {
  var action = e && e.parameter ? e.parameter.action : "";
  try {
    if (action === "pricing") {
      return jsonResponse({ ok: true, currency: "INR", plans: getPricing() });
    }
    if (action === "order") {
      return jsonResponse(createOrder(String(e.parameter.plan || ""), e.parameter.email));
    }
  } catch (err) {
    // For example "Missing Script Property: RAZORPAY_KEY_ID" (see Apps Script -> Executions).
    console.error(err);
    return jsonResponse({ ok: false, error: "unavailable" });
  }
  return ContentService.createTextOutput("MyLifeDock pricing and license mailer is LIVE.")
    .setMimeType(ContentService.MimeType.TEXT);
}

/** Razorpay webhook. */
function doPost(e) {
  return handleWebhook(e);
}

function handleWebhook(e) {
  try {
    var payload = JSON.parse(e.postData.contents);

    // Only the payment ID is taken from the (unauthenticated) webhook body.
    // Everything else comes from Razorpay's API.
    var claimedPayment = payload.payload && payload.payload.payment && payload.payload.payment.entity;
    var paymentId = claimedPayment && claimedPayment.id;

    if (!paymentId || !/^pay_[A-Za-z0-9]+$/.test(paymentId)) {
      return jsonResponse({ status: "ignored", reason: "no payment id" });
    }

    var lock = LockService.getScriptLock();
    lock.waitLock(30000);
    try {
      // Razorpay retries webhooks (and may send several events per purchase):
      // issue at most one license per payment.
      if (isPaymentAlreadyProcessed(paymentId)) {
        return jsonResponse({ status: "ignored", reason: "already processed" });
      }

      var paymentEntity = fetchRazorpay("payments/" + paymentId);
      if (!paymentEntity || paymentEntity.status !== "captured") {
        return jsonResponse({ status: "ignored", reason: "payment not verified as captured" });
      }

      return issueLicenseForVerifiedPayment(paymentEntity);
    } finally {
      lock.releaseLock();
    }
  } catch (err) {
    // Details stay in the Apps Script execution log, not in the public response.
    console.error(err);
    return jsonResponse({ status: "error" });
  }
}

function planInfo(tier) {
  return { tier: tier, days: PLANS[tier].days, title: PLANS[tier].title, validity: PLANS[tier].validity };
}

/**
 * Payment Pages (the backup checkout) have fixed amounts: the highest plan whose
 * regular price the amount covers. The lower of the Pricing tab price and the
 * default is used, so a price raised in the sheet before the backup page is
 * updated still maps that page's payments to the right plan.
 * Below the monthly price: 3-day test pass.
 */
function planForAmount(amountInRupees, pricing) {
  var best = null;
  var bestPrice = 0;
  Object.keys(PLANS).forEach(function (tier) {
    var price = Math.min(pricing[tier].priceINR, DEFAULT_PRICES_INR[tier]);
    if (amountInRupees >= price && price > bestPrice) {
      best = tier;
      bestPrice = price;
    }
  });
  return best ? planInfo(best) : TEST_PASS;
}

/** The order this script created for a website checkout payment, or null (Payment Pages). */
function websiteOrderFor(paymentEntity) {
  if (!paymentEntity.order_id || !/^order_[A-Za-z0-9]+$/.test(paymentEntity.order_id)) {
    return null;
  }
  var order = fetchRazorpay("orders/" + paymentEntity.order_id);
  return order && order.notes && order.notes.source === ORDER_SOURCE ? order : null;
}

/** The plan this payment bought. */
function planForPayment(paymentEntity, order) {
  // Website checkout: the plan was written on the order by createOrder (customers cannot change order notes).
  if (order && Object.prototype.hasOwnProperty.call(PLANS, order.notes.plan) && paymentEntity.amount >= order.amount) {
    return planInfo(order.notes.plan);
  }
  return planForAmount(paymentEntity.amount / 100, getPricing());
}

/** Where the key goes: the email typed on buy.html (saved on the order), else the one Razorpay collected. */
function customerEmailFor(paymentEntity, order) {
  return cleanEmail(order && order.notes.email) || cleanEmail(paymentEntity.email) || cleanEmail((paymentEntity.notes || {}).email);
}

/** The customer's name: the website checkout and Payment Pages both put it in the payment notes. */
function customerNameFrom(paymentEntity) {
  var notes = paymentEntity.notes || {};
  var keys = Object.keys(notes);
  for (var i = 0; i < keys.length; i++) {
    if (/name/i.test(keys[i]) && typeof notes[keys[i]] === "string" && notes[keys[i]].trim()) {
      return truncate(notes[keys[i]].trim(), 80);
    }
  }
  return "";
}

function issueLicenseForVerifiedPayment(paymentEntity) {
  var order = websiteOrderFor(paymentEntity);
  var customerEmail = customerEmailFor(paymentEntity, order);
  if (!customerEmail) {
    GmailApp.sendEmail(FOUNDER_EMAIL,
      "[MyLifeDock] Manual license needed: " + paymentEntity.id,
      "A verified payment of ₹" + (paymentEntity.amount / 100) + " (payment " + paymentEntity.id + ", mobile " +
      (paymentEntity.contact || "unknown") + ") has no email address. Contact the buyer and issue the key in the admin tool.");
    return jsonResponse({ status: "ignored", reason: "no email; founder notified" });
  }

  if (paymentEntity.currency !== "INR") {
    // Prices are in rupees. Leave other currencies for a manual license (admin tool).
    GmailApp.sendEmail(FOUNDER_EMAIL,
      "[MyLifeDock] Manual license needed: " + paymentEntity.id,
      "A verified " + paymentEntity.currency + " payment of " + (paymentEntity.amount / 100) +
      " from " + customerEmail + " needs a manually issued license (payment " + paymentEntity.id + ").");
    return jsonResponse({ status: "ignored", reason: "non-INR payment flagged for manual review" });
  }

  var amountInRupees = paymentEntity.amount / 100;
  var plan = planForPayment(paymentEntity, order);
  var customerName = customerNameFrom(paymentEntity);
  var phone = truncate(paymentEntity.contact || "", 20);

  var licenseKey = generateMLDLicense(customerEmail, plan.tier, plan.days).licenseKey;

  // Log first so a retry after a mail failure cannot issue a second license.
  logOrderToSheet(customerEmail, customerName, amountInRupees, plan, licenseKey, paymentEntity.id, phone);

  sendLicenseEmail(customerEmail, customerName || "there", plan, licenseKey);

  // Never echo the license key: this endpoint is public.
  return jsonResponse({ status: "success" });
}

/**
 * Generates the offline-verifiable license string.
 * Format: MLD-PRO-<base64 payload>.<base64url signature>
 */
function generateMLDLicense(email, tier, durationDays) {
  var payload = {
    tier: tier,
    email: email.trim().toLowerCase(),
    issuedAt: new Date().toISOString()
  };

  if (durationDays) {
    payload.expiresAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString();
  }

  var payloadJson = JSON.stringify(payload);
  var payloadB64 = Utilities.base64Encode(payloadJson, Utilities.Charset.UTF_8);

  // RSASSA-PKCS1-v1_5 / SHA-256 over the UTF-8 payload; the app verifies it
  // offline with the public key in src/config/licenseConfig.ts.
  var privateKeyPem = normalizePrivateKeyPem(getRequiredProperty("MLD_LICENSE_PRIVATE_KEY"));
  var signatureBytes = Utilities.computeRsaSha256Signature(payloadJson, privateKeyPem, Utilities.Charset.UTF_8);
  var signature = Utilities.base64EncodeWebSafe(signatureBytes).replace(/=+$/, "");

  return {
    licenseKey: "MLD-PRO-" + payloadB64 + "." + signature,
    payload: payload
  };
}

/**
 * Accepts the PEM as pasted into Script Properties, where line breaks are
 * often lost, and rebuilds the standard 64-column PKCS#8 format.
 */
function normalizePrivateKeyPem(pem) {
  var body = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "") // gitleaks:allow (PEM header literal, no key material)
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\\n/g, "")
    .replace(/\s+/g, "");
  return "-----BEGIN PRIVATE KEY-----\n" + body.match(/.{1,64}/g).join("\n") + "\n-----END PRIVATE KEY-----\n"; // gitleaks:allow
}

/** Sends the license email to the customer. */
function sendLicenseEmail(email, rawName, plan, licenseKey) {
  var subject = "Your MyLifeDock Pro license key";
  var name = escapeHtml(rawName);
  var planTitle = escapeHtml(plan.title);
  var validity = escapeHtml(plan.validity);

  var htmlBody = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0b0f19; color: #e2e8f0; border: 1px solid #1e293b; border-radius: 12px; overflow: hidden;">
      <div style="padding: 24px; background: linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%); text-align: center;">
        <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700;">MyLifeDock <span style="background: #facc15; color: #0f172a; padding: 2px 8px; border-radius: 4px; font-size: 14px;">PRO</span></h1>
        <p style="color: #ede9fe; margin: 8px 0 0 0; font-size: 14px;">Your family's private life vault</p>
      </div>

      <div style="padding: 32px 24px;">
        <p style="font-size: 16px; color: #f8fafc; margin-top: 0;">Hi ${name},</p>
        <p style="font-size: 14px; color: #cbd5e1; line-height: 1.6;">
          Thank you for buying <strong>${planTitle}</strong>. Your payment was successful. Here is your license key:
        </p>

        <div style="background: #111827; border: 1px solid #38bdf8; border-radius: 8px; padding: 16px; margin: 24px 0; text-align: center;">
          <div style="font-size: 11px; font-weight: 700; color: #38bdf8; letter-spacing: 0.05em; text-transform: uppercase; margin-bottom: 8px;">License key</div>
          <div style="font-family: monospace; font-size: 14px; color: #facc15; word-break: break-all; padding: 8px; background: rgba(0,0,0,0.4); border-radius: 6px;">
            ${licenseKey}
          </div>
          <div style="font-size: 12px; color: #94a3b8; margin-top: 8px;">Valid for: <strong>${validity}</strong></div>
        </div>

        <h3 style="color: #38bdf8; font-size: 16px; margin-top: 28px; margin-bottom: 12px;">How to activate</h3>
        <ol style="font-size: 14px; color: #cbd5e1; line-height: 1.8; padding-left: 20px;">
          <li>Open MyLifeDock on your Windows PC, Android phone or iPhone and unlock your vault.</li>
          <li>Go to <strong>Settings &amp; Backup</strong> &rarr; <strong>Plan</strong>.</li>
          <li>Paste the key and tap <strong>Activate Key</strong>.</li>
        </ol>

        <p style="font-size: 13px; color: #94a3b8; margin-top: 20px; line-height: 1.6;">
          The key is checked on your own device, so it works offline. Keep this email: you can use the same key again
          if you reinstall the app or move to a new device.
        </p>

        <p style="font-size: 13px; color: #94a3b8; margin-top: 20px;">
          Questions or a refund within 7 days? Just reply to this email.
        </p>

        <p style="font-size: 13px; color: #64748b; margin-bottom: 0;">
          Warm regards,<br>
          <strong>Dinesh, MyLifeDock</strong>
        </p>
      </div>

      <div style="background: #060911; padding: 16px 24px; text-align: center; border-top: 1px solid #1e293b; font-size: 12px; color: #475569;">
        © 2026 MyLifeDock · mylifedock@gmail.com
      </div>
    </div>
  `;

  var textBody =
    "Hi " + rawName + ",\n\n" +
    "Thank you for buying " + plan.title + ". Your license key:\n\n" + licenseKey + "\n\n" +
    "Valid for: " + plan.validity + "\n\n" +
    "To activate: open MyLifeDock > Settings & Backup > Plan, paste the key and tap Activate Key.\n\n" +
    "Questions? Reply to this email.\n\nDinesh, MyLifeDock";

  GmailApp.sendEmail(email, subject, textBody, {
    htmlBody: htmlBody,
    name: "MyLifeDock",
    replyTo: FOUNDER_EMAIL
  });
}

/**
 * Customer-typed values are stored as plain text: a leading = + - @ would
 * otherwise make Sheets run them as a formula (and "+91…" would lose its +).
 */
function asSheetText(value) {
  var s = String(value || "");
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

/**
 * Appends the order row and emails the founder at every LIFETIME_MILESTONE
 * lifetime sales.
 */
function logOrderToSheet(email, name, amount, plan, key, paymentId, phone) {
  var sheet = getOrdersSheet();
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(ORDER_HEADERS);
  }
  sheet.appendRow([new Date().toISOString(), asSheetText(name), asSheetText(email), amount, plan.title, key, paymentId, asSheetText(phone)]);

  if (plan.tier !== "pro_lifetime") {
    return;
  }
  try {
    var data = sheet.getDataRange().getValues();
    var lifetimeCount = 0;
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][4]).indexOf("Lifetime") !== -1) {
        lifetimeCount++;
      }
    }
    if (lifetimeCount > 0 && lifetimeCount % LIFETIME_MILESTONE === 0) {
      GmailApp.sendEmail(FOUNDER_EMAIL,
        "[MyLifeDock] " + lifetimeCount + " Lifetime licenses sold",
        "You have sold " + lifetimeCount + " Lifetime licenses.\n\n" +
        "To raise the Lifetime price, change 'Price ₹' for pro_lifetime in the Pricing tab of your Orders sheet.\n" +
        "The website, the Windows app and Razorpay checkout use the new price within a minute.\n" +
        "Also update the backup Lifetime Payment Page amount in Razorpay.\n");
    }
  } catch (e) {
    console.error(e);
  }
}

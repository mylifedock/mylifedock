/*
 * MyLifeDock website pricing and checkout.
 *
 * Live prices and offers come from the Pricing tab of the founder's Orders
 * sheet, served by the Apps Script web app (scripts/razorpay-auto-mailer.gs).
 * The pages also contain the regular prices, so they still work if that
 * service is slow or unreachable; checkout then falls back to the Razorpay
 * Payment Pages below (regular prices only).
 */
(function () {
  "use strict";

  // Apps Script Web App URL (Deploy -> Manage deployments). Must equal
  // PRICING_API_URL in src/config/pricingConfig.ts (npm run release:check).
  var PRICING_API_URL = "https://script.google.com/macros/s/AKfycbw44GxaH1cqekPHWf3C9pYyxD6nuH1VeJhXLbnYDIY0XtQp_IIBmn57EXywRgTlHd3y/exec";

  // Backup checkout (regular prices) when the pricing service cannot be reached.
  var PAYMENT_PAGES = {
    pro_monthly: "https://rzp.io/rzp/sV3WIhEH",
    pro_yearly: "https://rzp.io/rzp/rBBCp0Hy",
    pro_lifetime: "https://rzp.io/rzp/NjZh2xbD"
  };

  var PLAN_IDS = ["pro_monthly", "pro_yearly", "pro_lifetime"];
  var TIMEOUT_MS = 8000;

  function apiUrl() {
    return window.MLD_PRICING_API_URL || PRICING_API_URL;
  }

  function getJson(url) {
    var controller = typeof AbortController === "function" ? new AbortController() : null;
    var timer = controller ? setTimeout(function () { controller.abort(); }, TIMEOUT_MS) : 0;
    return fetch(url, { cache: "no-store", signal: controller ? controller.signal : undefined })
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .finally(function () { clearTimeout(timer); });
  }

  function isPrice(n) {
    return typeof n === "number" && isFinite(n) && n > 0;
  }

  /** Keeps only well-formed plans; anything odd falls back to the page's regular prices. */
  function clean(plans) {
    var out = {};
    PLAN_IDS.forEach(function (id) {
      var p = plans && plans[id];
      if (!p || !isPrice(p.priceINR) || !isPrice(p.priceUSD)) return;
      var offer = p.offer && isPrice(p.offer.priceINR) && isPrice(p.offer.priceUSD) && p.offer.priceINR < p.priceINR
        ? { priceINR: p.offer.priceINR, priceUSD: p.offer.priceUSD, text: String(p.offer.text || "Limited-time offer").slice(0, 80), endsOn: String(p.offer.endsOn || "") }
        : null;
      out[id] = { label: String(p.label || ""), priceINR: p.priceINR, priceUSD: p.priceUSD, offer: offer };
    });
    return Object.keys(out).length ? out : null;
  }

  /** Resolves to { pro_monthly: {...}, ... } or null when live prices are unavailable. */
  function loadPricing() {
    var url = apiUrl();
    if (!url) return Promise.resolve(null);
    return getJson(url + "?action=pricing")
      .then(function (data) { return data && data.ok ? clean(data.plans) : null; })
      .catch(function () { return null; });
  }

  /** Asks the pricing service to create a Razorpay order for the plan at its current price. */
  function createOrder(plan) {
    var url = apiUrl();
    if (!url) return Promise.reject(new Error("not configured"));
    return getJson(url + "?action=order&plan=" + encodeURIComponent(plan)).then(function (data) {
      if (!data || !data.ok || !/^order_[A-Za-z0-9]+$/.test(data.orderId || "") || !data.keyId) {
        throw new Error((data && data.error) || "unavailable");
      }
      return data;
    });
  }

  function inr(n) {
    return "₹" + Number(n).toLocaleString("en-IN");
  }

  function usd(n) {
    return "$" + Number(n).toFixed(2);
  }

  /** "15 Nov 2026" from "2026-11-15". */
  function day(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
    if (!m) return "";
    var months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return Number(m[3]) + " " + months[Number(m[2]) - 1] + " " + m[1];
  }

  window.MLDPricing = {
    PLAN_IDS: PLAN_IDS,
    loadPricing: loadPricing,
    createOrder: createOrder,
    paymentPage: function (plan) { return PAYMENT_PAGES[plan] || ""; },
    isLive: function () { return !!apiUrl(); },
    inr: inr,
    usd: usd,
    day: day
  };
})();

# Prices and offers: one place

Website and Windows prices and offers are controlled from the **Pricing** tab of the "MyLifeDock Orders" Google
Sheet. One edit there changes, within about a minute:

| What | How it follows the sheet |
| :--- | :--- |
| Website pricing cards, offer line and top banner | `docs/landing.html` loads `?action=pricing` from the Apps Script |
| Website checkout (`docs/buy.html`) | Collects name and email, then asks the Apps Script to create the Razorpay order at the current price (`?action=order&plan=…&email=…`); the key is emailed to that address |
| Amount Razorpay charges | The order amount set by the Apps Script |
| License plan in the email | Read from the order (the script writes the plan on it), so offers never confuse it |
| Windows app Upgrade screen | Loads the same prices; **Pay** opens the website checkout |

Not covered: **Android and iPhone** prices (Play Console / App Store Connect).

## The Pricing tab

Created by running `setupOrdersSheet` once in the Apps Script editor.

| Plan ID (do not change) | Plan | Price ₹ | Price $ (shown only) | Offer on | Offer price ₹ | Offer text | Offer ends (last day) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| pro_monthly | Monthly Pro | 25 | 0.49 | ☐ | | | |
| pro_yearly | Yearly Pro | 250 | 4.99 | ☐ | | | |
| pro_lifetime | Lifetime | 999 | 19.99 | ☑ | 699 | Diwali offer | 2026-11-15 |

Rules the script applies:
- Prices are whole rupees ≥ ₹1; an invalid cell falls back to the default price.
- An offer applies only when **Offer on** is ticked, the offer price is **below** the regular price, and today (India time)
  is on or before **Offer ends**. Empty end date = runs until you untick it.
- Prices are cached for 60 seconds, so changes show within about a minute.
- Type dates as `2026-11-15` (year-month-day). A date like `05-11-2026` is read in the sheet's locale (US = 11 May),
  so the offer may count as already ended. File → Settings → Locale: India avoids this.
- Check what customers see: `tools/hub.html` → Live prices and offers.
- Payments are always in rupees; dollar prices are only displayed (offer dollar prices are scaled automatically).

## One-time setup

1. Paste `scripts/razorpay-auto-mailer.gs` into the Apps Script project, Save, run `setupOrdersSheet`.
2. Deploy → Manage deployments → Edit → **New version** (the Web App URL stays the same).
3. Put the Web App URL (`https://script.google.com/macros/s/…/exec`) in **both**
   `src/config/pricingConfig.ts` (`PRICING_API_URL`) and `docs/assets/pricing.js` (`PRICING_API_URL`).
   `npm run release:check` fails until they are set and equal.
4. Razorpay → Account & Settings → **Business website**: `https://mylifedock.github.io` (live checkout started from
   an unregistered site can be blocked). Razorpay checks for the privacy, terms, refund and contact pages, which
   are published in `docs/`.
5. Publish the website and release the Windows app.

## Backup checkout

If the Apps Script cannot be reached, `buy.html` offers the Razorpay **Payment Pages** in `docs/assets/pricing.js`
at the regular price. Their amounts are fixed in Razorpay; keep them equal to the regular prices when you change a
price for good. The script maps those payments by amount, using the lower of the sheet price and its default, so a
price raised in the sheet does not downgrade buyers of an old page.

## Changing a regular price for good

1. Edit **Price ₹** in the Pricing tab (live within a minute).
2. Edit the backup Payment Page amount in Razorpay.
3. At the next release, update the built-in fallback prices; `npm run release:check` lists every place
   (`pricingConfig.ts`, `landing.html`/`index.html`, `buy.html`, `tools/admin.html`, `DEFAULT_PRICES_INR` in the script).

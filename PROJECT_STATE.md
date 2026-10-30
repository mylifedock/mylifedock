# MyLifeDock — Project State

> Last updated: 2026-10-31 · Version 1.4.0 · Working branch: `final-release-readiness` (merged to `main`)
>
> Read the source before trusting any document, this one included.

## Product

A private, encrypted family life vault: documents, products and warranties, insurance, money, vehicles and
property, medical records, secrets, emergency kit, reminders and search, for the owner and family members.
No account and no backend; data stays on the device, with encrypted file or Google Drive backup.

**Release targets (only these three):** Windows `.exe` (Tauri 2, NSIS), Android (Capacitor 8), iOS (Capacitor 8, SPM).
There is no web/PWA app. `docs/` is the marketing website on GitHub Pages.

## Where things are

| Topic | Document |
| :--- | :--- |
| How the code is organised, encryption, data model | [internal-docs/ARCHITECTURE.md](internal-docs/ARCHITECTURE.md) |
| What is left before release, owner inputs | [internal-docs/RELEASE_CHECKLIST.md](internal-docs/RELEASE_CHECKLIST.md) |
| Prices and offers (Pricing tab of the Orders sheet) | [internal-docs/PRICING_AND_OFFERS.md](internal-docs/PRICING_AND_OFFERS.md) |
| Google Play / App Store billing | [internal-docs/STORE_BILLING_SETUP.md](internal-docs/STORE_BILLING_SETUP.md) |
| Google sign-in clients for Drive backup | [internal-docs/GOOGLE_DRIVE_SETUP.md](internal-docs/GOOGLE_DRIVE_SETUP.md) |
| User-facing guide and brochure | [docs/guide.html](docs/guide.html), [docs/brochure.html](docs/brochure.html) |
| Founder start page (local: live prices, links, how-tos, admin tool) | [tools/hub.html](tools/hub.html) → [tools/admin.html](tools/admin.html) |

## Status (2026-10-31): live for Windows/website sales

- Free vault: 10 items; Pro: unlimited. INR first, USD second.
- **Website live** at https://mylifedock.github.io (GitHub Pages: branch `main`, folder `/docs`). CI on `main` passes.
- **Business:** MyLifeDock, sole proprietorship (MSME, Udyam). Footers, Contact, Terms and Privacy show only
  "MyLifeDock" and "Hyderabad, India"; proprietor, Udyam number and address (no flat number) are on
  `docs/business.html`, linked from every footer.
- **Payments live:** Razorpay account in the proprietor's name (approved 2026-10-30). Live keys, webhook
  (`payment.captured`) and `MLD_LICENSE_PRIVATE_KEY` are in Apps Script Script Properties. A real payment sent the
  licence email automatically.
- **Checkout:** `docs/buy.html` collects name **and email**, the Apps Script creates the order at the sheet price and
  saves the email on it, Razorpay opens with the email prefilled and locked. The key goes to that email (Razorpay's
  `void@razorpay.com` placeholder is ignored); a payment with no email emails the founder instead.
- **Pricing:** the Pricing tab of the "MyLifeDock Orders" sheet drives website, Windows and Razorpay prices and offers
  (verified with an offer). Type offer end dates as `yyyy-mm-dd`.
- **Backup Payment Pages** (only if the script is unreachable): `sV3WIhEH` ₹25, `rBBCp0Hy` ₹250, `NjZh2xbD` ₹999
  in `docs/assets/pricing.js`.
- **Founder tools (local only, never published):** `tools/hub.html` (live prices/offers, links, how-tos) and
  `tools/admin.html` (orders CSV, renewals, issue/inspect keys; remembers the key file in Chrome/Edge; `#generator`
  opens Issue key).
- Windows installer 1.4.0 with live pricing and Drive backup is built (not yet published on GitHub Releases).
- Google sign-in: Web, Android, iOS and Desktop clients configured in `.env` (iOS URL scheme in `Info.plist`).
- Android/iOS in-app purchase code is complete but off until the store products exist (`STORE_PRODUCTS_LIVE`).

## Resume here

1. Test purchase with the new email field (key arrives at the typed email, activates in the app, one sheet row);
   then untick the ₹1 test offer in the Pricing tab and refund the test payments in Razorpay.
2. Old Razorpay account: deactivate its 3 Payment Pages; send keys by hand to any of the earlier ₹117 buyers who got none.
3. Back up `%USERPROFILE%.mylifedocklicense-signing-private-key.pem` offline (USB/offline drive).
4. Publish the Windows installer on GitHub Releases (tag `v1.4.0`) and check the website's Download button.
5. Google Play and App Store: developer accounts, store listings, in-app products, then `STORE_PRODUCTS_LIVE`
   (`internal-docs/STORE_BILLING_SETUP.md`).

## Working rules

- Free tools only; never commit or print secrets (`.env`, signing keys, the licence private key).
- Gates before handing over a change: `npm run lint`, `npm run build`, `npm test`, `npm run release:check`.
- Keep `docs/landing.html` and `docs/index.html` identical, and `public/` and `docs/` privacy/terms identical.

The previous, longer state file is in `internal-docs/archive/PROJECT_STATE_2026-10-25.md` (outdated).

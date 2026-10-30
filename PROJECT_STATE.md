# MyLifeDock — Project State

> Last updated: 2026-10-27 · Version 1.4.0 · Working branch: `final-release-readiness` (merged to `main`)
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

## Status (2026-10-27)

- Free vault: 10 items; Pro: unlimited. INR first, USD second.
- **Website live** at https://mylifedock.github.io (GitHub Pages: branch `main`, folder `/docs`). Old public admin
  page removed. CI on `main` passes.
- **Pricing:** the Pricing tab of the "MyLifeDock Orders" Google Sheet drives website and Windows prices/offers through
  the Apps Script web app (`PRICING_API_URL`, live and verified). The same script creates Razorpay orders for
  `docs/buy.html` and emails RSA-signed licence keys.
- **Blocked on Razorpay (2026-10-28):** Razorpay declined the business website `mylifedock.github.io` until an
  MSME (Udyam) or GST certificate is uploaded; live API keys cannot be generated until it is approved. The three
  backup Payment Pages were still active on 2026-10-28 (correct amounts), so website buyers are sent there.
- **New plan (2026-10-28):** MSME certificate obtained (Udyam `UDYAM-TS-20-0223805`, enterprise "MYLIFEDOCK", Micro,
  services, proprietor = the founder's wife, address 201 Vayuputra Towers, KPHB Phase 2, Hyderabad 500072). A **new
  Razorpay account in her name** (Proprietorship) replaces the old one. The website now uses the name "MyLifeDock"
  (not "MyLifeDock Technologies"), the Hyderabad address, the Udyam number and the proprietor "Tulabandula Nikkitha" (commit
  5e6f9d2 on `final-release-readiness`; the user still has to run `git push origin final-release-readiness:main`
  to publish it, before submitting the website to the new Razorpay account). After approval: new API keys + webhook + three new Payment Pages
  (update `PAYMENT_PAGES` in `docs/assets/pricing.js`), then deactivate the old account's pages. The Apps Script has only `ORDERS_SHEET_ID` in Script Properties; it still needs
  `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` (live) and `MLD_LICENSE_PRIVATE_KEY`. Until then `buy.html` cannot create
  orders and falls back to the backup Payment Pages, and licences for those payments must be issued by hand
  (`tools/admin.html` → Issue key). ₹117 was collected before the keys existed; check those buyers got keys.
- **Script update pending:** `scripts/razorpay-auto-mailer.gs` now logs Razorpay errors to Executions; paste it into
  Apps Script and deploy a new version.
- Windows installer 1.4.0 with live pricing and Drive backup is built (not yet published on GitHub Releases).
- Google sign-in: Web, Android, iOS and Desktop clients configured in `.env` (iOS URL scheme in `Info.plist`).
- Android/iOS in-app purchase code is complete but off until the store products exist (`STORE_PRODUCTS_LIVE`).

## Resume here

**2026-10-30: Razorpay live.** The new account (proprietor's name) is approved. Live keys, the webhook
(`payment.captured`) and `MLD_LICENSE_PRIVATE_KEY` are in Apps Script, and the latest mailer is deployed;
`?action=order&plan=pro_monthly` returns `ok: true` with a `rzp_live_` key. New backup Payment Pages
(`sV3WIhEH` ₹25, `rBBCp0Hy` ₹250, `NjZh2xbD` ₹999) are in `docs/assets/pricing.js`. (The Razorpay notes above are history.)

1. Real ₹25 purchase on `buy.html` → email, sheet row, activation → refund. Then an offer test in the Pricing tab.
2. Deactivate the old Razorpay account's Payment Pages; send keys to the earlier ₹117 buyers if not done.
3. Publish the Windows installer on GitHub Releases (tag `v1.4.0`); back up the signing key offline.
4. Later: Google Play and App Store setup (`internal-docs/STORE_BILLING_SETUP.md`).

## Working rules

- Free tools only; never commit or print secrets (`.env`, signing keys, the licence private key).
- Gates before handing over a change: `npm run lint`, `npm run build`, `npm test`, `npm run release:check`.
- Keep `docs/landing.html` and `docs/index.html` identical, and `public/` and `docs/` privacy/terms identical.

The previous, longer state file is in `internal-docs/archive/PROJECT_STATE_2026-10-25.md` (outdated).

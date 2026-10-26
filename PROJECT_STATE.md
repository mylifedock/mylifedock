# MyLifeDock — Project State

> Last updated: 2026-10-26 · Version 1.4.0 · Working branch: `final-release-readiness`
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
| Google Play / App Store billing | [internal-docs/STORE_BILLING_SETUP.md](internal-docs/STORE_BILLING_SETUP.md) |
| User-facing guide and brochure | [docs/guide.html](docs/guide.html), [docs/brochure.html](docs/brochure.html) |

## Status

- Free vault: 10 items; Pro: unlimited. INR first, USD second.
- Windows sells Pro through Razorpay with RSA-signed licence keys (Apps Script mailer).
- Android/iOS in-app purchase code is complete but off until the store products exist (`STORE_PRODUCTS_LIVE`).
- Google Drive backup needs the OAuth client IDs per platform (`.env`, see `.env.example`).
- Open owner inputs: confirm the live Razorpay link per plan, OAuth clients, store accounts and products,
  signing certificates, legal review. See the release checklist.

## Working rules

- Free tools only; never commit or print secrets (`.env`, signing keys, the licence private key).
- Gates before handing over a change: `npm run lint`, `npm run build`, `npm test`, `npm run release:check`.
- Keep `docs/landing.html` and `docs/index.html` identical, and `public/` and `docs/` privacy/terms identical.

The previous, longer state file is in `internal-docs/archive/PROJECT_STATE_2026-10-25.md` (outdated).

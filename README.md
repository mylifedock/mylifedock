# 🛡️ MyLifeDock — Sovereign Personal & Family Vault

> **Zero-Knowledge • Offline-First • Cross-Platform Personal Data Dock**  
> Keep documents, warranties, receipts, assets, passwords, and life records safe with local AES-256-GCM encryption.

[![License](https://img.shields.io/badge/license-Proprietary-blue.svg)](LICENSE)
[![Security](https://img.shields.io/badge/Security-AES--256--GCM-success.svg)](#-technical-architecture)
[![Platforms](https://img.shields.io/badge/Platforms-Windows%20%7C%20Android%20%7C%20iOS-blueviolet.svg)](internal-docs/RELEASE_CHECKLIST.md)

---

## 🌟 Key Features

* 🔐 **100% Zero-Knowledge Encryption:** Data is encrypted on the client device using AES-256-GCM and PBKDF2 (600,000 iterations). The developer and cloud providers have zero access to keys or records.
* 📷 **Camera Invoice & Receipt Capture:** Direct hardware camera snapping for instant attachment and auto-fill across Documents, Products, and Warranties.
* ⚡ **On-Device OCR Engine:** High-performance WebAssembly worker pool (Tesseract.js) extracts dates, amounts, vendors, and warranty terms without uploading images anywhere.
* 🔎 **Universal Search:** One search box finds documents, policies, accounts, subscriptions and medical records for every family member, and opens the exact item.
* 🌐 **Global Multi-Currency Support:** Native formatting for Indian Rupee (`₹ INR` with Lakh/Crore grouping), US Dollar (`$ USD`), Euro (`€ EUR`), British Pound (`£ GBP`), UAE Dirham (`AED`), and more.
* 🚨 **Emergency Life Kit:** Instant access to critical medical information, blood groups, insurance policies, and ICE emergency contacts.
* 👆 **Hardware Biometrics:** Fingerprint and Face ID unlock in the Android and iOS apps (not offered on desktop, which has no OS biometric prompt in the app).
* ☁️ **Encrypted Cloud Sync:** Optional, zero-knowledge backup to personal Google Drive using client-side pre-encrypted binary blobs (native Google sign-in on Android/iOS, system-browser sign-in with PKCE on Windows).
* 🔑 **Offline Cryptographic Licensing:** Time-bound 6-month, 1-year, and lifetime subscription licensing verified mathematically offline without central activation servers.

---

## 🏗️ Technical Architecture

```
[UI Layer (React 19 + TypeScript)]
       │
       ├── State & Storage (Dexie.js / IndexedDB)
       │         ├── AES-256-GCM encrypted attachments
       │         └── Field-level AES-256-GCM record encryption (only IDs, owner and timestamps stay plaintext)
       │
       ├── Cryptographic Engine (Web Crypto API)
       │         ├── PBKDF2 (600,000 rounds, SHA-256)
       │         ├── AES-KW (Key Wrapping)
       │         └── Inactivity Auto-Lock Watchdog (30 min RAM purge)
       │
       └── Platform Abstraction Bridges
                 ├── Windows Desktop: Tauri v2 (NSIS .exe installer)
                 └── Mobile (Android / iOS): Capacitor v8
```

MyLifeDock ships as three apps only: Windows (.exe), Android and iOS. There is no web version;
the browser build (`npm run dev`) is for development and automated tests.

---

## 🚀 Quick Start & Development

### Prerequisites
* Node.js (v20+ recommended)
* npm (v10+)
* Rust & Cargo (only if compiling native Tauri Windows desktop builds)

### 1. Install Dependencies
```bash
npm ci
cp .env.example .env   # then fill in the Google OAuth client IDs (see the file)
```

### 2. Launch Local Development Server
```bash
npm run dev
```
Visit `http://localhost:5173` to work on the app in a browser. The marketing site and legal pages live in `docs/` (published with GitHub Pages).

### 3. Production Builds
* **Windows Desktop App (.exe):**
  ```bash
  npm run tauri:build:win
  ```
* **Android Release Bundle (.aab):**
  ```bash
  npm run build
  npx cap sync android
  cd android && ./gradlew bundleRelease
  ```
* **iOS (requires a Mac with Xcode):**
  ```bash
  npm run build
  npx cap sync ios
  open ios/App/App.xcodeproj
  ```

### 4. Security & Code Quality Gates
```bash
npm run lint            # ESLint incl. security plugin (0 errors, 0 warnings)
npm test                # Playwright tests (set PLAYWRIGHT_PORT if 5173 is busy)
npm run release:check   # release configuration gate (see internal-docs/RELEASE_CHECKLIST.md)
```

---

## 📚 Documentation

`docs/` is the public website (GitHub Pages). `internal-docs/` holds internal material that is never published
(index: [internal-docs/README.md](internal-docs/README.md)).

| Document | Description | Location |
| :--- | :--- | :--- |
| **Website** | Home page: features, security, pricing, downloads, FAQ (`index.html` is a copy of `landing.html`) | [docs/landing.html](docs/landing.html) |
| **User guide** | Setup, every section, family members, backup, security settings, troubleshooting | [docs/guide.html](docs/guide.html) |
| **Brochure** | Printable product brochure (Print → Save as PDF) | [docs/brochure.html](docs/brochure.html) |
| **Privacy & Terms** | Shown in the app and published on the website (`public/` and `docs/` copies are identical) | [privacy](docs/privacy.html) • [terms](docs/terms.html) |
| **Release checklist** | Steps and owner inputs for each release | [internal-docs/RELEASE_CHECKLIST.md](internal-docs/RELEASE_CHECKLIST.md) |
| **Prices and offers** | One edit in the Pricing tab of the Orders sheet updates website, checkout and Windows app | [internal-docs/PRICING_AND_OFFERS.md](internal-docs/PRICING_AND_OFFERS.md) |
| **Store billing setup** | Google Play Billing and App Store In-App Purchase | [internal-docs/STORE_BILLING_SETUP.md](internal-docs/STORE_BILLING_SETUP.md) |
| **Architecture** | Layers, encryption, data model, platforms, payments | [internal-docs/ARCHITECTURE.md](internal-docs/ARCHITECTURE.md) |

To render the internal Markdown docs to HTML:
```bash
node scripts/build_docs_html.js
```

---
## ⚖️ Legal & Privacy

MyLifeDock enforces a strict Zero-Knowledge liability policy. If the user loses their Master Passphrase and Recovery Key, encrypted data is mathematically irrecoverable. The developer cannot decrypt or recover vaults under any circumstances.

**Support Contact:** `mylifedock@gmail.com`

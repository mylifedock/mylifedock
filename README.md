# 🛡️ MyLifeDock — Sovereign Personal & Family Vault

> **Zero-Knowledge • Offline-First • Cross-Platform Personal Data Dock**  
> Keep documents, warranties, receipts, assets, passwords, and life records safe with local AES-256-GCM encryption.

[![License](https://img.shields.io/badge/license-Proprietary-blue.svg)](LICENSE)
[![Security](https://img.shields.io/badge/Security-AES--256--GCM-success.svg)](docs/MyLifeDock_Security_Audit_2026.html)
[![Platforms](https://img.shields.io/badge/Platforms-Windows%20%7C%20Android%20%7C%20iOS%20%7C%20Web-blueviolet.svg)](docs/MyLifeDock_Production_Release_Guide.html)

---

## 🌟 Key Features

* 🔐 **100% Zero-Knowledge Encryption:** Data is encrypted on the client device using AES-256-GCM and PBKDF2 (100,000 iterations). The developer and cloud providers have zero access to keys or records.
* 📷 **Camera Invoice & Receipt Capture:** Direct hardware camera snapping for instant attachment and auto-fill across Documents, Products, and Warranties.
* ⚡ **On-Device OCR Engine:** High-performance WebAssembly worker pool (Tesseract.js) extracts dates, amounts, vendors, and warranty terms without uploading images anywhere.
* 🎙️ **Real-time Live Voice Search:** Native `webkitSpeechRecognition` engine with continuous audio streaming to search documents, products, assets, and reminders.
* 🌐 **Global Multi-Currency Support:** Native formatting for Indian Rupee (`₹ INR` with Lakh/Crore grouping), US Dollar (`$ USD`), Euro (`€ EUR`), British Pound (`£ GBP`), UAE Dirham (`AED`), and more.
* 🚨 **Emergency Life Kit:** Instant access to critical medical information, blood groups, insurance policies, and ICE emergency contacts.
* 👆 **Hardware Biometrics:** Fingerprint, Face ID, and Windows Hello authorization backed by the OS Keychain / Secure Enclave.
* ☁️ **Encrypted Cloud Sync:** Optional, zero-knowledge backup to personal Google Drive using client-side pre-encrypted binary blobs.
* 🔑 **Offline Cryptographic Licensing:** Time-bound 6-month, 1-year, and lifetime subscription licensing verified mathematically offline without central activation servers.

---

## 🏗️ Technical Architecture

```
[UI Layer (React 19 + TypeScript)]
       │
       ├── State & Storage (Dexie.js / IndexedDB)
       │         └── AES-256-GCM Ciphertext Tables
       │
       ├── Cryptographic Engine (Web Crypto API)
       │         ├── PBKDF2 (100,000 rounds, SHA-256)
       │         ├── AES-KW (Key Wrapping)
       │         └── Inactivity Auto-Lock Watchdog (30 min RAM purge)
       │
       └── Platform Abstraction Bridges
                 ├── Windows Desktop: Tauri v2 (Rust NSIS .exe & .msi)
                 ├── Mobile (Android / iOS): Capacitor v8
                 └── Web / PWA: Vite Edge PWA with Service Worker
```

---

## 🚀 Quick Start & Development

### Prerequisites
* Node.js (v20+ recommended)
* npm (v10+)
* Rust & Cargo (only if compiling native Tauri Windows desktop builds)

### 1. Install Dependencies
```bash
npm install --legacy-peer-deps
```

### 2. Launch Local Development Server
```bash
npm run dev
```
Visit `http://localhost:5173` to test the Web Vault or `http://localhost:5173/landing.html` to preview the marketing landing page.

### 3. Production Builds
* **Web / PWA Build:**
  ```bash
  npm run build
  ```
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

### 4. Security & Code Quality Gates
```bash
npm run lint    # ESLint security plugin scan (0 errors)
npm test        # End-to-end Playwright tests
```

---

## 📚 Complete Documentation Suite (`docs/`)

All documentation is pre-rendered in both Markdown and interactive standalone HTML format:

| Document | Description | Format |
| :--- | :--- | :--- |
| **User Handbook** | Complete user manual and day-to-day vault operations | [HTML](docs/MyLifeDock_User_Handbook.html) • [MD](docs/MyLifeDock_User_Handbook.md) |
| **Product Specs** | System architecture, data flow, and threat model | [HTML](docs/MyLifeDock_Product_Documentation.html) • [MD](docs/MyLifeDock_Product_Documentation.md) |
| **Security Audit (2026)** | Official SAST, OSA, and DAST zero-knowledge verification | [HTML](docs/MyLifeDock_Security_Audit_2026.html) • [MD](docs/MyLifeDock_Security_Audit_2026.md) |
| **Release Playbook** | Store deployment guide for Windows, Play Store, and Cloudflare | [HTML](docs/MyLifeDock_Production_Release_Guide.html) • [MD](docs/MyLifeDock_Production_Release_Guide.md) |
| **Legal & Patent Blueprint** | India-to-Global entity setup, patent forms, and dual billing | [HTML](docs/Legal_Patent_Application_Guide.html) • [MD](docs/Legal_Patent_Application_Guide.md) |
| **Future Scope Strategy** | Multi-year product roadmap, licensing, and moat analysis | [HTML](docs/MyLifeDock_Future_Scope_Strategy.html) • [MD](docs/MyLifeDock_Future_Scope_Strategy.md) |
| **Android Play Store Guide**| Keystore generation and `.aab` Google Play submission | [HTML](docs/Android_PlayStore_Guide.html) • [MD](docs/Android_PlayStore_Guide.md) |
| **Landing Page** | Production-ready marketing landing page | [HTML](public/landing.html) |

To recompile all documentation from Markdown to HTML:
```bash
node scripts/build_docs_html.js
```

---

## ⚖️ Legal & Privacy

MyLifeDock enforces a strict Zero-Knowledge liability policy. If the user loses their Master Passphrase and Recovery Key, encrypted data is mathematically irrecoverable. The developer cannot decrypt or recover vaults under any circumstances.

**Support Contact:** `mylifedock@gmail.com`

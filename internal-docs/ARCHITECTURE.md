# MyLifeDock Architecture

One React codebase, three apps: **Windows** (Tauri 2, NSIS installer), **Android** and **iOS** (Capacitor 8).
There is no web version and no backend. `docs/` is only the marketing website.

## 1. Layers

```text
src/
├── ui/              React screens and components (no direct crypto or storage calls)
│   ├── pages/       one page per section (Documents, Products, Insurance, Money, Assets, Medical,
│   │                Secrets, Emergency Kit, Reminders, Search, Settings, Help)
│   └── components/  shared UI (Sidebar, RecordCollection, AttachmentManager, ProUpgradeModal, Toast…)
├── application/     use cases: one service per domain (documentService, productService, backupService,
│                    licenseService, storeBillingService, googleDriveService, reminderService, ocrService…)
├── security/        vault key lifecycle (vaultKeyService), VaultGate, record crypto, unlock throttle
├── infrastructure/  Dexie database (db.ts) and the field-encryption middleware
├── platform/        platform bridges: desktopBridge (Tauri), externalActivity, fileExport
└── config/          pricing, licence public key, store products, checkout policy
```

Rules: UI calls application services; services own persistence; only `security/` and the middleware touch keys.

## 2. Vault and encryption

```text
passphrase ──PBKDF2-SHA-256, 600,000 rounds, 16-byte salt──▶ AES-KW wrapping key
                                                              │ unwrap
recovery key (64 hex) ──────────── second wrapped copy ───────▶ AES-256-GCM vault key (memory only, non-extractable)
```

- `vaultSecurity` holds the salt and the two wrapped copies of the vault key. The passphrase is never stored;
  the minimum length is 12.
- **Records:** `recordEncryptionMiddleware` (Dexie DBCore) encrypts every field except ids, owner/relationship ids
  and timestamps, with AES-256-GCM and a fresh 12-byte IV per write. Schema v7 removed indexes on sensitive fields.
  While locked, only the plaintext fields are visible.
- **Attachments:** encrypted blobs in IndexedDB, decrypted only for preview/download while unlocked.
- **Locking:** inactivity timer (1–60 min), lock on app switch (paused during camera/file/share via
  `externalActivity`), tray "Lock Vault" on Windows, throttled retries after wrong passphrases.
- **Biometric unlock** (Android/iOS, `biometricService`): the unlock secret is kept in OS secure storage
  (Keystore/Keychain, this device only) and released after a biometric prompt.
- Android sets `FLAG_SECURE`; iOS blurs the app-switcher snapshot (`SceneDelegate.swift`).

## 3. Data model (Dexie, database "MyLifeDock", schema v7)

| Table | Holds |
| :--- | :--- |
| `profiles` | the owner and family members (health basics live here once); each profile holds its emergency kit, and the owner's also holds subscriptions |
| `documents`, `attachments` | papers and their encrypted files |
| `products`, `coverages` | products, and every warranty / extended warranty / AMC / insurance policy (the Insurance section lists `type === "insurance"`) |
| `finance` | accounts, cards (last 4 only), investments, loans |
| `vehicles`, `properties` | assets, linked to coverages |
| `medicalRecords` | prescriptions and lab reports per profile |
| `secrets` | PINs and passwords (encrypted fields, never searched) |
| `reminders` | generated and manual reminders |
| `vaultSecurity` | key metadata (see 2) |

Every add goes through `vaultLimitService`: the free vault holds 10 items in total; Pro is unlimited.

## 4. Backup and restore

- **File:** `.mldv` export of the encrypted vault (records stay encrypted; the key metadata travels with it),
  imported on any platform with the passphrase or recovery key.
- **Google Drive:** the same encrypted file in the app's hidden `appDataFolder` (`drive.appdata` scope only).
  Sign-in: `@capgo/capacitor-social-login` on Android/iOS, browser + loopback + PKCE on Windows.
  A platform without a configured OAuth client hides Drive backup.

## 5. Platform services

| Need | Windows (Tauri) | Android / iOS (Capacitor) |
| :--- | :--- | :--- |
| Files | plugin-fs + plugin-dialog | Filesystem + Share |
| Notifications | plugin-notification | local-notifications |
| Secure secrets | — | secure-storage (biometric unlock) |
| Open links | plugin-shell (allow-listed) | App / system browser |
| OCR | tesseract.js with self-hosted worker, core and English data (works offline) | same |

## 6. Pro and payments

- `getCheckoutChannel()` (`config/storePolicy.ts`): Windows → Razorpay; Android → Google Play Billing;
  iOS → App Store In-App Purchase.
- **Licence keys** (Razorpay → Google Apps Script → email) are `MLD-PRO-…` payloads signed with RSASSA-PKCS1-v1_5 /
  SHA-256 and verified offline against `LICENSE_PUBLIC_KEY_SPKI`. The private key lives only on the founder's PC and in
  Apps Script properties.
- **Store purchases** (`storeBillingService`, `@capgo/native-purchases`) are read from the store on launch and unlock
  and held in memory only. A valid licence key takes precedence.
- Setup and policy: [STORE_BILLING_SETUP.md](STORE_BILLING_SETUP.md).

## 7. Quality gates

| Gate | Command |
| :--- | :--- |
| Types and bundle | `npm run build` |
| Lint (incl. security rules) | `npm run lint` |
| Tests (Playwright: unit, crypto, e2e, mobile, UI controls, billing rules) | `npm test` (`PLAYWRIGHT_PORT` if 5173 is busy) |
| Release configuration | `npm run release:check` |
| Dependencies | `npm audit --omit=dev`, `cargo audit` |
| Android | `./gradlew assembleDebug lintDebug` with JDK 21 |

CI (`.github/workflows/ci.yml`) runs lint, build and tests on every push.

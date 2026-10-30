# MyLifeDock — Release Checklist (v1.4.0)

MyLifeDock ships as **three apps**: Windows desktop (.exe), Android and iOS. There is no web version;
`docs/` is the marketing website (landing page, privacy policy, terms).

Items marked **(you)** need a decision, an account or a device only the founder has.

## 0. Automated gates

```powershell
npm ci
npm run lint                     # 0 errors, 0 warnings
npm run build                    # tsc + vite production build
$env:PLAYWRIGHT_PORT = '5181'; npm test   # use a free port if `npm run dev` is already running
npm run release:check            # configuration gate; every check must pass
npm audit --omit=dev             # production dependencies
cd src-tauri; cargo test; cargo audit
```

`release:check` passes (15/15) as of 2026-10-27. Its `NOTE` lines list anything optional that is still off
(store billing, platforms without Drive backup).

## 1. Payments and licensing **(you)**

Prices and offers: [PRICING_AND_OFFERS.md](PRICING_AND_OFFERS.md).

**Status 2026-10-27:** the website is under Razorpay review; live API keys are available only after approval.
Until then, website checkout falls back to the backup Payment Pages and licences are issued by hand from
`tools/admin.html` (Issue key → Send via Gmail, paste with Ctrl+V and send → Copy row for Orders sheet).
**2026-10-28:** Razorpay declined the website until an MSME (Udyam) or GST certificate is uploaded; keys stay manual
until approval (a secret-token webhook is the fallback if approval takes weeks).

- [x] Apps Script deployed with the pricing service; `setupOrdersSheet` run (Orders sheet + Pricing tab exist,
      `ORDERS_SHEET_ID` set). `?action=pricing` verified live.
- [ ] Paste the latest `scripts/razorpay-auto-mailer.gs` (logs Razorpay errors to Executions), Deploy → New version.
- [ ] Script Properties: `MLD_LICENSE_PRIVATE_KEY` (can be added now), `RAZORPAY_KEY_ID` + `RAZORPAY_KEY_SECRET`
      (live, after Razorpay approves the website).
- [ ] Razorpay webhook in **Live** mode: the Web App URL, event `payment.captured`.
- [ ] Check the ₹117 collected before the keys existed: issue licences by hand to any real buyer who got none.
- [x] Put the Web App URL (`https://script.google.com/macros/s/…/exec`) in `PRICING_API_URL` in both
      `src/config/pricingConfig.ts` and `docs/assets/pricing.js`.
- [x] Razorpay → Account & Settings → Business website: `https://mylifedock.github.io` (refund and contact pages,
      with the business address, are in `docs/`).
- [ ] Backup Payment Pages (used only if the pricing service is unreachable) in `docs/assets/pricing.js`:
      Monthly `sV3WIhEH` ₹25, Yearly `rBBCp0Hy` ₹250, Lifetime `NjZh2xbD` ₹999, each with Email, Phone and a **Name** field.
- [ ] Back up `~/.mylifedock/license-signing-private-key.pem` offline. Losing it means no new licenses can be issued.
- [ ] Make one real ₹-payment end to end through `buy.html`: key emailed once, activates in the app, appears once in
      the sheet with the buyer's name and phone. Then try an offer in the Pricing tab and check the website and checkout
      show it. Import the sheet CSV in `tools/admin.html` and check the orders show as valid.
- [ ] Re-issue keys sold before the RSA switch (old HMAC keys are rejected with a support message).

## 2. Google sign-in for Drive backup **(you)**

Step by step: [GOOGLE_DRIVE_SETUP.md](GOOGLE_DRIVE_SETUP.md).

All three clients must be in the same Google Cloud project as the existing Web client, with the
`drive.appdata` scope on the OAuth consent screen. Put the IDs in `.env` (see `.env.example`), then rebuild.
A platform without its client simply hides Drive backup; the encrypted file export always works.

- [ ] **Android:** create an *Android* OAuth client for package `com.mylifedock.app` with the SHA-1 of the Play
      **app signing** key (Play Console → App integrity) and of your upload/debug key. The app sends the *Web*
      client ID (`VITE_GOOGLE_CLIENT_ID`); never put the Android client ID there.
- [ ] **iOS:** create an *iOS* OAuth client for the bundle ID, set `VITE_GOOGLE_IOS_CLIENT_ID`, and add its reversed
      ID (`com.googleusercontent.apps.…`) under `CFBundleURLTypes` → `CFBundleURLSchemes` in `ios/App/App/Info.plist`.
      `release:check` fails if the ID is set without the URL scheme (Google Sign-In would crash).
- [ ] **Windows:** create a *Desktop app* OAuth client and set `VITE_GOOGLE_DESKTOP_CLIENT_ID` and
      `VITE_GOOGLE_DESKTOP_CLIENT_SECRET` (Google treats a desktop client secret as non-confidential). The app opens the
      system browser, receives the redirect on `127.0.0.1`, and exchanges the code with PKCE.
- [ ] Consent screen in **Production** (or add testers as test users), with the privacy policy URL.

## 3. In-app purchases on Android and iOS **(you, before any store submission)**

The code is built and switched off (`STORE_PRODUCTS_LIVE = false` in `src/config/storeProducts.ts`).
Full steps: [STORE_BILLING_SETUP.md](STORE_BILLING_SETUP.md).

- Windows keeps Razorpay; Android uses Google Play Billing; iOS uses In-App Purchase (`src/config/storePolicy.ts`).
- [ ] Play Console: payments profile, 15% fee program, subscriptions `mylifedock.pro.monthly` (base plan `monthly`) and
      `mylifedock.pro.yearly` (base plan `yearly`), one-time product `mylifedock.pro.lifetime`, licence testers.
- [ ] App Store Connect: Paid Apps Agreement active, Small Business Program, In-App Purchase capability in Xcode,
      subscription group "MyLifeDock Pro" with the two subscriptions, non-consumable lifetime, sandbox testers.
- [ ] Set `STORE_PRODUCTS_LIVE = true`, rebuild, `npx cap sync`, and run the device tests in STORE_BILLING_SETUP.md section 5.
- [ ] Do not submit the iOS app while `STORE_PRODUCTS_LIVE` is `false` (its "coming soon" note mentions website keys).

## 4. Android (Play Store)

- [ ] Build with JDK 21 (Android Studio's bundled JBR 25 is too new for Gradle 8.14):
      `$env:JAVA_HOME = "$env:USERPROFILE\.jdks\jbr-21.0.11"; npm run build; npx cap sync android; cd android; ./gradlew bundleRelease lintRelease`
- [ ] Release signing key (upload key) configured; enroll in Play App Signing.
- [ ] Version comes from `package.json` (versionName 1.4.0, versionCode 10400). Bump `package.json` for every upload.
- [ ] Data safety form: no data collected or shared by the app; Google sign-in is used only to authorize Drive backup
      (the app signs out after each backup); purchases are processed by Google Play; users delete data by uninstalling.
- [ ] Privacy policy URL: the published `docs/privacy.html`.
- [ ] Test on a real device: vault create/unlock, fingerprint unlock, receipt photo (camera) and file attach
      **without the vault locking**, attachment preview/share/download, PDF "Open with…", Emergency Kit export,
      reminders after reboot, Drive backup + restore, FLAG_SECURE in Recent Apps, back button.

## 5. iOS (App Store) — requires a Mac with Xcode

- [ ] `npm run build; npx cap sync ios`, open `ios/App/App.xcodeproj`, build (SPM). The Google sign-in plugin
      (`@capgo/capacitor-social-login`, Google provider only, no Facebook SDK) and `SceneDelegate.swift`
      (app-switcher privacy blur) have not been compiled yet; fix any Swift errors.
- [ ] Decide export compliance (`ITSAppUsesNonExemptEncryption`): the app uses standard AES/PBKDF2 for data protection.
- [ ] Privacy nutrition label and app privacy manifest (`PrivacyInfo.xcprivacy`) review; App Review notes explaining
      zero-knowledge (no account).
- [ ] Test on device: Face ID unlock (Keychain, this-device-only), camera scan,
      app-switcher blur, Drive backup + restore (once step 2 is done), share sheet.

## 6. Windows desktop (Tauri)

- [ ] `npm run tauri:build:win` produces the NSIS installer `src-tauri/target/x86_64-pc-windows-msvc/release/bundle/nsis/MyLifeDock_1.4.0_x64-setup.exe`.
- [ ] Code-signing certificate (otherwise SmartScreen and Smart App Control warn or block the download).
- [ ] Test: install, vault create/unlock, backup export to a user folder, attachment save, PDF preview, Emergency Kit
      export, tray "Lock Vault", minimize-to-lock, Drive backup + restore through the browser (once step 2 is done),
      "Buy" opens the payment page in the browser.

## 7. Website (`docs/`)

- [x] Publish `docs/` (GitHub Pages, branch `main`, folder `/docs`; live since 2026-10-27): `index.html` (a copy of `landing.html`; keep both identical),
      `guide.html`, `brochure.html`, `buy.html`, `privacy.html`, `terms.html`, `refunds.html`, `contact.html`, `404.html`, `assets/`.
- [ ] Upload the signed installer to GitHub Releases; the landing page's Windows button links there.
- [ ] When the Android/iOS apps are live, replace the "coming soon" buttons on the landing page with the store links.

## 8. Legal **(you)**

- [ ] Have `privacy.html` and `terms.html` reviewed by a lawyer (drafted from the app's actual behaviour;
      governing law is set to India). `public/` and `docs/` hold identical copies.
- [ ] Never describe `internal-docs/MyLifeDock_Security_Audit_2026.md` as an independent audit (it is internal and no longer published).

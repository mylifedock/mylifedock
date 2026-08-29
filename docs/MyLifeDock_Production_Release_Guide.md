# 🚀 MyLifeDock Production & Store Release Playbook
**Scope:** Windows (.exe / Store), Android (Google Play), Web Hosting, Google Cloud Console, and Marketing.  
**Strategy:** Low-Cost / Free Tier First • Zero Maintenance Backend • Maximum User Trust  

---

## 🌐 Phase 1: Web Hosting & Landing Page (Free / Ultra-Low Cost)

Because MyLifeDock is a client-side offline app, you do not need expensive backend servers, databases, or Redis instances. Hosting is **100% free on global edge networks**.

### Recommended Hosting Options:

| Platform | Cost | Custom Domain + SSL | Build Command | Output Dir |
| :--- | :--- | :--- | :--- | :--- |
| **Cloudflare Pages (Recommended)** | Free ($0/mo) | Free Unlimited SSL | `npm run build` | `dist` |
| **Vercel** | Free Tier | Free SSL | `npm run build` | `dist` |
| **GitHub Pages** | Free ($0/mo) | Free SSL | GitHub Actions | `dist` |

### Step-by-Step Deployment to Cloudflare Pages:
1. Create a free account at [cloudflare.com](https://cloudflare.com).
2. Connect your GitHub repository `mylifedock/mylifedock`.
3. Set **Framework Preset**: `Vite`.
4. Set **Build command**: `npm run build`.
5. Set **Build output directory**: `dist`.
6. Add Environment Variable: `VITE_GOOGLE_CLIENT_ID=<your-id>`.
7. Click **Save and Deploy**. Your web app and PWA are live globally within 60 seconds!

---

## 🪟 Phase 2: Windows Release Strategy (.exe & Microsoft Store)

### Option 1: Direct Download Installer (Free & Instant)
- **Built File:** `src-tauri/target/x86_64-pc-windows-msvc/release/bundle/nsis/MyLifeDock_1.0.0_x64-setup.exe`
- **Distribution:** Upload this `.exe` directly to **GitHub Releases** or host it as a direct download link on your marketing website.
- **Auto-Updates:** Tauri includes a built-in auto-updater mechanism that checks a free GitHub Releases JSON endpoint and auto-updates the user's PC!

### Option 2: Microsoft Store Submission
- **Cost:** One-time developer registration fee of **$19 USD** (no annual renewal).
- **Format:** Package as `.msix` or submit the `.exe` via MSIX Packaging Tool / Microsoft Partner Center.
- **Benefit:** Automatic installation, seamless background updates, and zero Windows SmartScreen warnings.

---

## 🤖 Phase 3: Android Release (Google Play Store)

### Step 1: Google Play Developer Account
- Go to [play.google.com/console/signup](https://play.google.com/console/signup).
- Pay the **one-time $25 USD registration fee**.

### Step 2: Generate Release Keystore
Run in PowerShell:
```powershell
keytool -genkey -v -keystore mylifedock-release.keystore -alias mylifedock -keyalg RSA -keysize 2048 -validity 10000
```
*(Store this keystore file and passphrase in your private backup safe!)*

### Step 3: Build Android App Bundle (.aab)
1. Open Android Studio:
   ```powershell
   npx cap open android
   ```
2. In Android Studio: **Build** -> **Generate Signed Bundle / APK** -> **Android App Bundle (.aab)**.
3. Select your `mylifedock-release.keystore`.
4. Output file: `app-release.aab`.

### Step 4: Google Play Store Data Safety & Privacy Declarations
Because MyLifeDock is Zero-Knowledge:
- **Data Collection:** Select "No personal data collected or shared with third parties".
- **Data Encryption in Transit:** Select "Yes, all data is encrypted locally using AES-256".
- **Account Deletion:** Local data is deleted whenever the user uninstalls the app or clicks "Clear Vault".

---

## ☁️ Phase 4: Google Cloud Console Configuration Checklist

To ensure Google Drive Cloud Backup works in production:

1. **Open Google Cloud Console:** [console.cloud.google.com](https://console.cloud.google.com)
2. **OAuth Consent Screen:**
   - App Name: `MyLifeDock`
   - User Support Email: `support@mylifedock.com` (or your email)
   - Scope: Add `https://www.googleapis.com/auth/drive.appdata`
   - Publishing Status: Change from *Testing* to *Production* (or add test user emails).
3. **Credentials / OAuth Client IDs:**
   - **Web Application Client ID:**
     - Authorized JavaScript Origins:
       - `http://localhost:5173` (Development)
       - `https://your-domain.com` (Production Web)
       - `tauri://localhost` (Windows / macOS Desktop)
     - Authorized Redirect URIs:
       - `http://localhost:5173`
       - `https://your-domain.com`
   - **Android Client ID (for native Google Auth):**
     - Package name: `com.mylifedock.app`
     - SHA-1 certificate fingerprint: Paste the SHA-1 from `keytool -list -v -keystore mylifedock-release.keystore`.

---

## 🍏 Phase 5: macOS & iOS Roadmap (Future Steps)

- **Apple Developer Account:** $99/year.
- **macOS Build:** Run `npm run tauri:build:mac` on a Mac to produce `MyLifeDock.dmg` and notarize with `xcrun notarytool`.
- **iOS Build:** Run `npx cap open ios` on a Mac, archive in Xcode, and submit to TestFlight / App Store.

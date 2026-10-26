# Google Drive backup: Google sign-in setup

Drive backup needs one Google **OAuth client** per platform, all in the same Google Cloud project as the existing
**Web client** (its ID starts with `350340206913-`; it is already in `.env` as `VITE_GOOGLE_CLIENT_ID`).
Until a platform has its client, the app simply hides Drive backup there; file backup always works. Free of charge.

| Platform | Client type | What the app needs | Status |
| :--- | :--- | :--- | :--- |
| Android | Android | Nothing in `.env`: the client only has to exist with the right SHA-1 (the app sends the Web client ID) | Check it exists (step 3a) |
| iPhone | iOS | `VITE_GOOGLE_IOS_CLIENT_ID` + URL scheme in `Info.plist` | To do |
| Windows | Desktop app | `VITE_GOOGLE_DESKTOP_CLIENT_ID` + `VITE_GOOGLE_DESKTOP_CLIENT_SECRET` | To do |

## 1. Open the project

1. Go to <https://console.cloud.google.com> and sign in with the account that owns MyLifeDock.
2. In the project picker at the top, choose the project that contains the Web client
   (Menu → **APIs & Services → Credentials**: a "Web application" client whose ID starts with `350340206913-`).
3. Menu → **APIs & Services → Library** → search **Google Drive API** → **Enable** (skip if already enabled).

## 2. Consent screen (Google Auth Platform)

Menu → **Google Auth Platform** (older consoles: *OAuth consent screen*).

1. **Branding:** App name *MyLifeDock*, support email `mylifedock@gmail.com`, home page
   `https://mylifedock.github.io/`, privacy policy `https://mylifedock.github.io/privacy.html`,
   terms `https://mylifedock.github.io/terms.html`.
2. **Data access → Add or remove scopes:** add only `https://www.googleapis.com/auth/drive.appdata`
   (the app's hidden folder; it cannot see the user's other Drive files).
3. **Audience:** *External*. While testing, add your own Gmail accounts under **Test users**. Before release,
   click **Publish app** (Google may ask for a short verification; the privacy policy is already published).

## 3. Create the clients (Google Auth Platform → Clients → Create client)

### a. Android
- Application type **Android**, name `MyLifeDock Android`, package name `com.mylifedock.app`.
- SHA-1 of this PC's debug key (for test builds):
  `39:D0:28:5C:6C:9F:C4:33:6D:D0:36:CD:D4:94:3A:86:24:30:C6:E9`
- After the first upload to Play Console, create a **second** Android client with the SHA-1 from
  Play Console → **Test and release → App integrity → App signing key certificate**. (Phones installed from
  Google Play are signed with that key, not yours.) Add a third one for your upload key if you sideload release builds.
- Nothing to copy back: an Android client works by package name + SHA-1.

### b. iOS
- Application type **iOS**, name `MyLifeDock iOS`, bundle ID `com.mylifedock.app`.
- Copy the **Client ID** (ends in `.apps.googleusercontent.com`) and send it to the developer, or add it yourself:
  `VITE_GOOGLE_IOS_CLIENT_ID=<id>` in `.env`, and its reversed form
  (`com.googleusercontent.apps.<numbers-and-letters>`) under `CFBundleURLSchemes` in `ios/App/App/Info.plist`.
  `npm run release:check` fails if one is set without the other.

### c. Windows (Desktop)
- Application type **Desktop app**, name `MyLifeDock Windows`.
- Google shows a **Client ID** and **Client secret**. Put both in `.env` yourself:
  ```
  VITE_GOOGLE_DESKTOP_CLIENT_ID=<client id>
  VITE_GOOGLE_DESKTOP_CLIENT_SECRET=<client secret>
  ```
  Google treats a desktop app's secret as not confidential (it ships inside the app), but keep `.env` out of git
  (it already is). Sign-in opens the browser and returns to the app on `127.0.0.1`; no redirect URI is needed.

## 4. Rebuild and test

1. `npm run release:check`: the iOS/Windows "Drive backup is hidden" notes disappear once the IDs are set.
2. Rebuild: `npm run tauri:build:win` (Windows), `npm run build; npx cap sync` (Android/iOS).
3. On each platform: Settings & Backup → Backup & Sync → **Backup to Google Drive**, then restore it on another device.

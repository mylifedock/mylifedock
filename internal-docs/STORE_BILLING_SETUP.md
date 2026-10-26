# Google Play & App Store Billing Setup

How MyLifeDock sells Pro on each platform, what is already built, and the exact console steps needed
before the in-app purchases go live. Nothing here needs a server.

## 1. How it works

| Build | Checkout | Code path | How Pro is proven |
| :--- | :--- | :--- | :--- |
| Windows (.exe, Tauri) | Razorpay payment page in the browser; licence key emailed by the Apps Script | `getCheckoutChannel() === "razorpay"` | RSA-signed licence key, verified offline |
| Android | Google Play Billing (in the app) | `"google-play"` | Active Play purchase, re-read from Google Play on launch and unlock |
| iOS | Apple In-App Purchase (StoreKit 2) | `"app-store"` | Active App Store transaction, re-read on launch and unlock |

- `src/config/storePolicy.ts`: `getCheckoutChannel()` returns `razorpay` for every build that is **not** a Capacitor
  native app (the Windows app and the dev browser), `google-play` on Android and `app-store` on iOS.
  That is the only switch: the Android and iOS apps never show Razorpay, prices from the website or external links.
- `src/config/storeProducts.ts`: product IDs and the `STORE_PRODUCTS_LIVE` switch (currently `false`).
- `src/application/storeBillingService.ts`: loads store prices, buys, restores, and turns the store's purchases into a
  Pro status (`@capgo/native-purchases`: StoreKit 2 on iOS, Play Billing 7 on Android).
- `src/application/licenseService.ts`: the store status is held **in memory only** (it cannot be faked by editing
  storage) and refreshed from the store on every launch and unlock. A valid licence key always wins.
- `src/ui/components/ProUpgradeModal.tsx`: one Upgrade screen with three modes:
  - Razorpay (Windows),
  - store (live store prices, Subscribe/Buy, Restore purchases, auto-renew terms),
  - "coming soon" while `STORE_PRODUCTS_LIVE` is `false`.
  The licence-key box is shown everywhere, so a Windows customer can use their key on a phone.
- Settings › Plan shows **Manage subscription** (opens the store's subscription page) and **Restore purchases**.

Policy basis:
- Google Play requires Play Billing for digital goods sold in the app. India's user-choice billing still requires Play
  Billing alongside it and only lowers the fee by 4%, so it is not worth it at these prices.
- Apple 3.1.1 requires IAP for unlocking features. 3.1.3(b) (multiplatform services) allows the app to accept a
  licence bought elsewhere **as long as IAP is also offered**, and the iOS app must not link to or mention the website
  purchase.

## 2. Products to create (must match `storeProducts.ts` exactly)

| Plan | Product ID | Google Play | App Store |
| :--- | :--- | :--- | :--- |
| Monthly | `mylifedock.pro.monthly` | Subscription, base plan ID `monthly`, auto-renewing, 1 month | Auto-renewable subscription, 1 month, group "MyLifeDock Pro" |
| Yearly | `mylifedock.pro.yearly` | Subscription, base plan ID `yearly`, auto-renewing, 1 year | Auto-renewable subscription, 1 year, same group |
| Lifetime | `mylifedock.pro.lifetime` | One-time product (non-consumable) | Non-consumable |

Product IDs cannot be reused once deleted in either console, so copy them exactly. Suggested prices are the website's:
₹25/month, ₹250/year and ₹999 lifetime. Let each store generate the other countries' prices from INR.

## 3. Google Play Console

1. **Developer account:** play.google.com/console, one-time US$25. Choose *Personal* or *Organization*.
   A new personal account must run a closed test with at least 12 testers for 14 days before production access.
2. **Payments profile:** Play Console › Settings › Payments profile. Link or create a Google payments merchant profile
   with bank account and PAN (and GST if registered). Without it you cannot create paid products.
3. **Create the app:** All apps › Create app; name *MyLifeDock*, App, Free (the app is free with in-app purchases).
4. **Upload a build that contains the billing permission.** The Products menu stays locked until a build with
   `com.android.vending.BILLING` is uploaded (it is already in `AndroidManifest.xml`).
   - Build with JDK 21: `npm run build; npx cap sync android; cd android; ./gradlew bundleRelease`
   - Upload `android/app/build/outputs/bundle/release/app-release.aab` to Testing › Internal testing and
     accept Play App Signing.
5. **15% fee:** Settings › Developer account › *15% service fee program* (enrol; otherwise one-time products pay 30%).
6. **Subscriptions:** Monetize › Products › Subscriptions › Create subscription.
   - Product ID `mylifedock.pro.monthly`, name "MyLifeDock Pro Monthly".
   - Add base plan › ID `monthly`, Auto-renewing, billing period 1 month, grace period 7 days (recommended),
     resubscribe allowed. Set price ₹25 and Activate.
   - Repeat with `mylifedock.pro.yearly` and base plan `yearly` (1 year, ₹250).
   - Do **not** add free-trial offers yet; the app does not show offer text.
7. **One-time product:** Monetize › Products › In-app products › Create product. ID `mylifedock.pro.lifetime`,
   price ₹999, Activate.
8. **Testers:** Settings › License testing. Add the Gmail accounts that will test; their purchases are free test
   purchases. Add the same accounts to the internal testing track and open the opt-in link on the phone.
9. **Data safety:** update the answer for purchases: "Purchase history" is handled by Google Play, not collected by the app.

## 4. Apple App Store Connect (needs a Mac with Xcode)

1. **Apple Developer Program:** developer.apple.com/programs, US$99 per year. An *Organization* needs a D-U-N-S number.
2. **Agreements:** App Store Connect › Business: accept the **Paid Apps Agreement** and add bank and tax forms.
   In-app purchases do not load until the agreement status is *Active*.
3. **Small Business Program:** apply at developer.apple.com/app-store/small-business-program (15% instead of 30%).
4. **Bundle ID and app:** Certificates, Identifiers & Profiles › Identifiers: register `com.mylifedock.app` with
   the *In-App Purchase* capability. Then App Store Connect › Apps › New App with that bundle ID.
5. **Xcode:** open `ios/App/App.xcodeproj` › target App › Signing & Capabilities › + Capability › *In-App Purchase*.
6. **Subscriptions:** your app › Monetization › Subscriptions › create group **MyLifeDock Pro**.
   - Add `mylifedock.pro.monthly` (1 month, ₹25) and `mylifedock.pro.yearly` (1 year, ₹250).
   - Give the yearly a **higher** level than the monthly so a switch counts as an upgrade.
   - Each needs a display name, a description, and a review screenshot of the Upgrade screen.
   - Add the group localization (English).
7. **Non-consumable:** Monetization › In-App Purchases › + › Non-Consumable, `mylifedock.pro.lifetime`, ₹999,
   with a review screenshot.
8. **First submission:** the in-app purchases must be attached to the first app version submitted for review
   (on the version page, *In-App Purchases and Subscriptions*).
9. **App Review notes:** "Pro is unlocked only through In-App Purchase in this app. Customers of the Windows app
   can also enter a licence key they already own." Provide a sandbox account if asked.
10. **Sandbox testers:** Users and Access › Sandbox › Testers. Sign in with the tester on the iPhone under
    Settings › App Store › Sandbox Account.
11. **Privacy:** App Privacy › "Purchases" is collected by Apple, not by the app; the existing privacy manifest stays.

## 5. Turning it on

1. Products created and **Active** in both consoles (IDs exactly as in section 2).
2. Set `STORE_PRODUCTS_LIVE = true` in `src/config/storeProducts.ts`, then `npm run build; npx cap sync`.
3. `npm run release:check`: the in-app product check must pass with no `NOTE`.
4. Test on real devices with test accounts:
   - Upgrade screen shows the store's prices (not the website's) and no Razorpay button.
   - Buy monthly → Pro active → force-close and reopen → still Pro.
   - Cancel in the store › after expiry (test renewals are minutes long) → back to Free on next unlock.
   - Buy lifetime → Pro Lifetime; Settings shows no "Manage subscription".
   - Uninstall/reinstall or a second device → **Restore purchases** brings Pro back.
   - Cancel the store dialog → no error message; airplane mode → Upgrade screen says it could not load plans.
   - A website licence key still activates Pro on the phone.
   - Play: a test card that declines, then a "slow" test card (pending): Pro must appear only once paid.
5. Windows build: unchanged; the Upgrade screen still shows Razorpay.

## 6. Known limits (by design, no server)

- Entitlement is checked on the device against the store's own records (StoreKit 2 signed transactions on iOS,
  the Play Billing client on Android). There is no server-side receipt validation, so a rooted/jailbroken device
  could fake a purchase. At these prices that is an acceptable trade-off; a server can be added later without
  changing the app's screens.
- Store purchases do not create a licence key, so a phone purchase does not unlock the Windows app. The website FAQ
  ("Does Pro work on all my devices?") says so.
- Before `STORE_PRODUCTS_LIVE` is `true`, the phone apps show a "coming soon" note that mentions website licence keys.
  Do not submit the iOS app to review in that state (Apple 3.1.1); submit it with the products live.
- Refunds and cancellations are handled by Google and Apple; the app drops Pro on the next launch or unlock after
  the store reports it.

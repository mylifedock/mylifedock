import { Capacitor } from "@capacitor/core";

/**
 * Where Pro is bought on each platform.
 *
 * - Android (Google Play): Google Play Billing. Play's Payments policy does not
 *   allow linking to an outside checkout for app features.
 * - iOS (App Store): Apple In-App Purchase (App Store Review Guideline 3.1.1).
 * - Windows desktop (self-distributed .exe): Razorpay checkout in the browser.
 *   The browser build used for development behaves like desktop.
 *
 * License keys bought on desktop can still be entered in the mobile apps;
 * both stores allow unlocking a purchase made elsewhere as long as the same
 * thing is also sold through the store's own billing (Apple 3.1.3(b)).
 */
export type CheckoutChannel = "google-play" | "app-store" | "razorpay";

export function getCheckoutChannel(): CheckoutChannel {
  if (!Capacitor.isNativePlatform()) return "razorpay";
  return Capacitor.getPlatform() === "ios" ? "app-store" : "google-play";
}

/** Razorpay (an outside checkout) is offered only where the stores' rules do not apply: the Windows app. */
export function isExternalCheckoutAllowed(): boolean {
  return getCheckoutChannel() === "razorpay";
}

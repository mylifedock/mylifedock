/**
 * =========================================================================
 * MYLIFEDOCK PRO: AUTO-UPDATING LOADER — RETIRED
 * =========================================================================
 *
 * The previous loader downloaded razorpay-auto-mailer.gs from GitHub on every
 * request and ran it with eval(). That gave anyone able to change that file
 * (or the account/branch it came from) code execution with this script's
 * Gmail and Sheets permissions, and it bypassed review of what actually ran.
 *
 * WHAT TO DO INSTEAD:
 * 1. Open your Apps Script project (Google Sheet -> Extensions -> Apps Script).
 * 2. Replace the loader code with the full contents of
 *    scripts/razorpay-auto-mailer.gs and follow the setup steps at its top
 *    (Script Properties: RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET,
 *    MLD_LICENSE_PRIVATE_KEY).
 * 3. Deploy -> Manage deployments -> edit the existing Web app deployment ->
 *    Version: "New version". The Web App URL stays the same, so the Razorpay
 *    webhook does not need to change.
 *
 * When the mailer changes, paste the reviewed new version and deploy a new
 * version the same way.
 * =========================================================================
 */

function doPost(e) {
  return ContentService.createTextOutput(JSON.stringify({
    status: "error",
    message: "Loader retired: deploy scripts/razorpay-auto-mailer.gs directly."
  })).setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  return ContentService.createTextOutput("MyLifeDock loader retired: deploy razorpay-auto-mailer.gs directly.")
    .setMimeType(ContentService.MimeType.TEXT);
}

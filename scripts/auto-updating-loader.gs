/**
 * =========================================================================
 * MYLIFEDOCK PRO: AUTO-UPDATING LOADER (Google Apps Script)
 * =========================================================================
 * 
 * 🚀 PERMANENT ZERO-MAINTENANCE LOADER:
 * Paste this single lightweight file into Google Apps Script ONCE.
 * You will NEVER need to copy-paste or update code in Google Apps Script again!
 * 
 * Whenever a payment or feedback arrives, this loader automatically fetches 
 * the latest production script from your GitHub repository and executes it.
 * 
 * SETUP (One-Time Only - Takes 2 Minutes):
 * 1. Open your Google Sheet -> Extensions -> Apps Script.
 * 2. Replace all existing code with this file.
 * 3. Click "Deploy" -> "New Deployment" -> Select "Web app":
 *    - Description: "MyLifeDock Auto Loader v1"
 *    - Execute as: "Me (mylifedock@gmail.com)"
 *    - Who has access: "Anyone"
 * 4. Authorize permissions once when prompted. That's it!
 * =========================================================================
 */

var REMOTE_SCRIPT_URL = "https://raw.githubusercontent.com/mylifedock/mylifedock.github.io/main/app/scripts/razorpay-auto-mailer.gs";

function doPost(e) {
  try {
    var response = UrlFetchApp.fetch(REMOTE_SCRIPT_URL + "?cache_bust=" + new Date().getTime());
    var remoteCode = response.getContentText();
    eval(remoteCode);
    return handleWebhook(e);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ 
      status: "error", 
      stage: "loader", 
      message: err.toString() 
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  return ContentService.createTextOutput("MyLifeDock Auto-Updating Webhook Loader is LIVE and connected to GitHub!")
    .setMimeType(ContentService.MimeType.TEXT);
}

// Scopes declaration: ensures Google prompts for Gmail and Sheets permissions on first deployment
function _declareGoogleScopes() {
  GmailApp.getAliases();
  SpreadsheetApp.getActiveSpreadsheet();
}

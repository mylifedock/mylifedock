/**
 * =========================================================================
 * MYLIFEDOCK PRO: ZERO-COST RAZORPAY AUTO-MAILER (Google Apps Script)
 * =========================================================================
 * 
 * HOW IT WORKS:
 * 1. A customer pays via https://razorpay.me/@bssdinesh (UPI, GPay, Cards).
 * 2. Razorpay sends a Webhook notification to this Google Apps Script.
 * 3. This script generates the cryptographic license key (MLD-PRO-...).
 * 4. This script automatically emails the license key to the buyer from your Gmail.
 * 5. This script logs the customer name, email, amount, and key in your Google Sheet.
 * 
 * SETUP INSTRUCTIONS (Takes ~3 minutes):
 * 1. Open Google Sheets (https://sheets.new) -> Name it "MyLifeDock Orders".
 * 2. Click "Extensions" -> "Apps Script".
 * 3. Delete any default code, paste this entire file, and click "Save".
 * 4. Click "Deploy" -> "New Deployment" -> Select "Web app".
 *    - Execute as: "Me"
 *    - Who has access: "Anyone"
 * 5. Click "Deploy", authorize Gmail permissions, and COPY the Web App URL.
 * 6. Open Razorpay Dashboard (https://dashboard.razorpay.com/) -> Settings -> Webhooks.
 *    - Add Webhook: Paste your Web App URL.
 *    - Events to subscribe: "payment.captured", "payment_link.paid".
 * =========================================================================
 */

function doPost(e) {
  try {
    var rawData = e.postData.contents;
    var payload = JSON.parse(rawData);

    // -------------------------------------------------------------------------
    // ACTION 1: INCOMING USER FEEDBACK SUBMISSION
    // -------------------------------------------------------------------------
    if (payload.action === "feedback" || payload.type === "feedback") {
      var category = payload.category || "General";
      var userSubject = payload.subject ? payload.subject.trim() : "App Experience";
      var emailSubject = "[MyLifeDock Feedback] " + category + ": " + userSubject;
      var userEmail = payload.email ? payload.email.trim() : "anonymous@user.com";
      var userName = payload.name ? payload.name.trim() : "Valued User";
      var ratingStars = payload.rating ? "★".repeat(payload.rating) + "☆".repeat(5 - payload.rating) + " (" + payload.rating + "/5)" : "Not rated";

      var textBody = 
        "NEW USER FEEDBACK RECEIVED\n" +
        "==================================================\n" +
        "Category : " + category + "\n" +
        "Subject  : " + userSubject + "\n" +
        "Rating   : " + ratingStars + "\n" +
        "From     : " + userName + " <" + userEmail + ">\n" +
        "Date     : " + new Date().toISOString() + "\n" +
        "Platform : " + (payload.platform || "Unknown") + "\n" +
        "==================================================\n\n" +
        "MESSAGE:\n" +
        (payload.message || "(No message provided)") + "\n\n" +
        (payload.diagnostics ? "--- SYSTEM DIAGNOSTICS ---\n" + payload.diagnostics + "\n" : "");

      GmailApp.sendEmail("mylifedock@gmail.com", emailSubject, textBody, {
        name: "MyLifeDock Feedback Bot",
        replyTo: userEmail
      });

      logFeedbackToSheet(category, userSubject, payload.rating, userName, userEmail, payload.message);

      return ContentService.createTextOutput(JSON.stringify({ status: "success", message: "Feedback delivered" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // -------------------------------------------------------------------------
    // ACTION 2: RAZORPAY PAYMENT WEBHOOK NOTIFICATION
    // -------------------------------------------------------------------------
    // Extract payment details from Razorpay payload
    var paymentEntity = null;
    if (payload.payload && payload.payload.payment && payload.payload.payment.entity) {
      paymentEntity = payload.payload.payment.entity;
    } else if (payload.event && payload.event.includes("payment")) {
      paymentEntity = payload.entity || payload;
    }

    if (!paymentEntity) {
      return ContentService.createTextOutput(JSON.stringify({ status: "ignored", reason: "no payment entity" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    var customerEmail = paymentEntity.email;
    var customerName = paymentEntity.notes && paymentEntity.notes.name ? paymentEntity.notes.name : "Valued Customer";
    var amountInRupees = paymentEntity.amount ? (paymentEntity.amount / 100) : 25;

    if (!customerEmail) {
      return ContentService.createTextOutput(JSON.stringify({ status: "ignored", reason: "no email in payment" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // Determine license tier based on amount paid:
    // < ₹100 (e.g. ₹25 or test payment)  -> Monthly Pro (30 Days)
    // ₹100 to < ₹500 (e.g. ₹250 or ₹116)  -> Yearly Pro (365 Days - Save 2 Months Free!)
    // >= ₹500 (e.g. ₹999)                 -> Lifetime Founder License (Never Expires)
    var tier = "pro_yearly";
    var durationDays = 365;
    var planTitle = "MyLifeDock Pro (1-Year - Save 2 Months Free)";
    
    if (amountInRupees < 100) {
      tier = "pro_monthly";
      durationDays = 30;
      planTitle = "MyLifeDock Pro (Monthly - 30 Days)";
    } else if (amountInRupees >= 500) {
      tier = "pro_lifetime";
      durationDays = null;
      planTitle = "MyLifeDock Lifetime Founder License";
    }

    // Generate cryptographic license key
    var licenseData = generateMLDLicense(customerEmail, tier, durationDays);
    var licenseKey = licenseData.licenseKey;

    // Send the email to the buyer
    sendLicenseEmail(customerEmail, customerName, planTitle, licenseKey, tier);

    // Log to Google Sheet
    logOrderToSheet(customerEmail, customerName, amountInRupees, planTitle, licenseKey);

    return ContentService.createTextOutput(JSON.stringify({ status: "success", licenseKey: licenseKey }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Generates the offline verifiable license string
 * Format: MLD-PRO-base64EncodedPayload.signature
 */
function generateMLDLicense(email, tier, durationDays) {
  var payload = {
    tier: tier,
    email: email.trim().toLowerCase(),
    issuedAt: new Date().toISOString()
  };

  if ((tier === "pro_yearly" || tier === "pro_monthly") && durationDays) {
    var expiry = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000);
    payload.expiresAt = expiry.toISOString();
  }

  var payloadJson = JSON.stringify(payload);
  var payloadB64 = Utilities.base64Encode(payloadJson, Utilities.Charset.UTF_8);

  // Compute HMAC signature using SHA-256
  var salt = "mld_vault_sovereign_signature_2026_secure";
  var signatureBytes = Utilities.computeHmacSignature(
    Utilities.MacAlgorithm.HMAC_SHA_256,
    payloadJson,
    salt
  );
  var signatureHex = signatureBytes.map(function(b) {
    return ("0" + (b & 0xff).toString(16)).slice(-2);
  }).join("").substring(0, 32);

  var licenseKey = "MLD-PRO-" + payloadB64 + "." + signatureHex;

  return {
    licenseKey: licenseKey,
    payload: payload
  };
}

/**
 * Sends a clean, branded HTML email to the customer
 */
function sendLicenseEmail(email, name, planTitle, licenseKey, tier) {
  var subject = "Your MyLifeDock PRO License Key & Activation Instructions";
  
  var validityText = "30 Days (Full Access)";
  if (tier === "pro_yearly") {
    validityText = "1 Year / 365 Days (Full Access - Includes 2 Months Free)";
  } else if (tier === "pro_lifetime") {
    validityText = "Lifetime Unlimited (Never Expires)";
  }

  var htmlBody = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0b0f19; color: #e2e8f0; border: 1px solid #1e293b; border-radius: 12px; overflow: hidden;">
      <div style="padding: 24px; background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%); text-align: center;">
        <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700;">MyLifeDock <span style="background: #eab308; color: #0f172a; padding: 2px 8px; border-radius: 4px; font-size: 14px;">PRO</span></h1>
        <p style="color: #e0f2fe; margin: 8px 0 0 0; font-size: 14px;">Sovereign Zero-Knowledge Life Vault</p>
      </div>

      <div style="padding: 32px 24px;">
        <p style="font-size: 16px; color: #f8fafc; margin-top: 0;">Hi ${name},</p>
        <p style="font-size: 14px; color: #cbd5e1; line-height: 1.6;">
          Thank you for choosing <strong>${planTitle}</strong>! Your payment was successful. Here is your official offline cryptographic license key:
        </p>

        <div style="background: #111827; border: 1px solid #38bdf8; border-radius: 8px; padding: 16px; margin: 24px 0; text-align: center;">
          <div style="font-size: 11px; font-weight: 700; color: #38bdf8; letter-spacing: 0.05em; text-transform: uppercase; margin-bottom: 8px;">YOUR OFFICIAL LICENSE KEY</div>
          <div style="font-family: monospace; font-size: 14px; color: #facc15; word-break: break-all; padding: 8px; background: rgba(0,0,0,0.4); border-radius: 6px; user-select: all;">
            ${licenseKey}
          </div>
          <div style="font-size: 12px; color: #94a3b8; margin-top: 8px;">Validity: <strong>${validityText}</strong></div>
        </div>

        <h3 style="color: #38bdf8; font-size: 16px; margin-top: 28px; margin-bottom: 12px;">How to Activate in 3 Easy Steps:</h3>
        <ol style="font-size: 14px; color: #cbd5e1; line-height: 1.8; padding-left: 20px;">
          <li>Open the <strong>MyLifeDock</strong> app on your Android device or computer.</li>
          <li>Go to <strong>Settings (⚙️)</strong> &rarr; scroll to <strong>MyLifeDock PRO</strong>.</li>
          <li>Paste the key above into the box and click <strong>Activate Key</strong>.</li>
        </ol>

        <div style="background: rgba(34, 197, 94, 0.1); border: 1px solid rgba(34, 197, 94, 0.3); border-radius: 8px; padding: 14px; margin-top: 24px;">
          <strong style="color: #4ade80; font-size: 13.5px;">✓ 100% Zero-Knowledge Verified</strong>
          <p style="color: #cbd5e1; font-size: 12.5px; margin: 4px 0 0 0;">
            Your key is mathematically validated on your local device. MyLifeDock runs zero servers and never accesses your private documents.
          </p>
        </div>

        <p style="font-size: 13px; color: #94a3b8; margin-top: 28px;">
          Need any assistance? Simply reply directly to this email and our support team will help you promptly.
        </p>

        <p style="font-size: 13px; color: #64748b; margin-bottom: 0;">
          Warm regards,<br>
          <strong>Dinesh & The MyLifeDock Team</strong>
        </p>
      </div>

      <div style="background: #060911; padding: 16px 24px; text-align: center; border-top: 1px solid #1e293b; font-size: 12px; color: #475569;">
        © 2026 MyLifeDock Technologies • Zero-Knowledge Personal Vault
      </div>
    </div>
  `;

  GmailApp.sendEmail(email, subject, "Your MyLifeDock Pro Key: " + licenseKey, {
    htmlBody: htmlBody,
    name: "MyLifeDock Team"
  });
}

/**
 * Appends the order row to the active Google Sheet
 */
function logOrderToSheet(email, name, amount, plan, key) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(["Timestamp", "Customer Name", "Customer Email", "Amount (INR)", "Plan", "License Key"]);
    }
    sheet.appendRow([new Date().toISOString(), name, email, amount, plan, key]);
  } catch (e) {
    // Silent fail if no sheet attached
  }
}

/**
 * Appends feedback to a dedicated 'Feedback' sheet
 */
function logFeedbackToSheet(category, subject, rating, name, email, message) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("User Feedback");
    if (!sheet) {
      sheet = ss.insertSheet("User Feedback");
      sheet.appendRow(["Timestamp", "Category", "Rating", "Subject", "User Name", "User Email", "Message"]);
    }
    sheet.appendRow([new Date().toISOString(), category, rating, subject, name, email, message]);
  } catch (e) {
    // Silent fail
  }
}

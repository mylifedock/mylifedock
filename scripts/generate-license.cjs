#!/usr/bin/env node

/**
 * MyLifeDock Offline Cryptographic License Key Generator
 * 
 * Usage:
 *   node scripts/generate-license.cjs --email "user@gmail.com" --tier lifetime
 *   node scripts/generate-license.cjs --email "user@gmail.com" --tier yearly
 */

const crypto = require("crypto");

// Secret signing seed used to generate deterministic mathematical signatures
const SIGNING_SALT = "mld_vault_sovereign_signature_2026_secure";

function generateLicenseKey({ email, tier, durationDays }) {
  const normalizedTier = tier === "lifetime" || tier === "pro_lifetime" ? "pro_lifetime" : "pro_yearly";
  
  const payload = {
    tier: normalizedTier,
    email: email ? email.trim().toLowerCase() : undefined,
    issuedAt: new Date().toISOString(),
  };

  if (normalizedTier === "pro_yearly") {
    const days = durationDays || 365;
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    payload.expiresAt = expiresAt.toISOString();
  }

  const payloadJson = JSON.stringify(payload);
  const payloadB64 = Buffer.from(payloadJson, "utf8").toString("base64");

  // Generate cryptographic signature (HMAC-SHA256)
  const hmac = crypto.createHmac("sha256", SIGNING_SALT);
  hmac.update(payloadJson);
  const signature = hmac.digest("hex").substring(0, 32);

  const licenseKey = `MLD-PRO-${payloadB64}.${signature}`;

  return {
    licenseKey,
    payload,
  };
}

// Parse CLI args
const args = process.argv.slice(2);
let email = "";
let tier = "lifetime";
let days = 365;

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--email" && args[i + 1]) {
    email = args[i + 1];
    i++;
  } else if (args[i] === "--tier" && args[i + 1]) {
    tier = args[i + 1];
    i++;
  } else if (args[i] === "--days" && args[i + 1]) {
    days = parseInt(args[i + 1], 10);
    i++;
  }
}

if (!email) {
  email = "customer@example.com";
}

const result = generateLicenseKey({ email, tier, durationDays: days });

console.log("\n=======================================================");
console.log(" 🛡️  MYLIFEDOCK PRO LICENSE KEY GENERATED");
console.log("=======================================================");
console.log(`\nCustomer Email : ${email}`);
console.log(`License Tier   : ${result.payload.tier}`);
console.log(`Issued Date    : ${result.payload.issuedAt}`);
if (result.payload.expiresAt) {
  console.log(`Expires At     : ${result.payload.expiresAt}`);
} else {
  console.log(`Expires At     : LIFETIME (Never Expires)`);
}
console.log(`\n🔑 LICENSE KEY:`);
console.log(`-------------------------------------------------------`);
console.log(result.licenseKey);
console.log(`-------------------------------------------------------`);

console.log("\n📧 READY-TO-SEND CUSTOMER EMAIL TEMPLATE:");
console.log("-------------------------------------------------------");
console.log(`Subject: Your MyLifeDock PRO License Key & Activation Instructions

Hi there,

Thank you for purchasing MyLifeDock PRO!

Here is your official license key:

${result.licenseKey}

HOW TO ACTIVATE IN 3 STEPS:
1. Open the MyLifeDock app on your Android phone, PC, or iPhone.
2. Go to Settings (⚙️) -> "MyLifeDock PRO License".
3. Paste your license key above and click "Activate Key".

Your vault is now unlocked with Unlimited Storage, All Future Updates, and 100% Zero-Knowledge security.

Need help? Reply directly to this email.

Best regards,
MyLifeDock Team
`);
console.log("=======================================================\n");

#!/usr/bin/env node

/**
 * MyLifeDock Offline Cryptographic License Key Generator
 *
 * Signs licenses with the private key created by
 * scripts/generate-license-keypair.cjs (RSASSA-PKCS1-v1_5 / SHA-256).
 *
 * Usage:
 *   node scripts/generate-license.cjs --email "user@gmail.com" --tier lifetime
 *   node scripts/generate-license.cjs --email "user@gmail.com" --tier yearly
 *   node scripts/generate-license.cjs --email "user@gmail.com" --tier monthly --days 3
 *
 * Private key location: --key <path>, else $MLD_LICENSE_PRIVATE_KEY_PATH,
 * else ~/.mylifedock/license-signing-private-key.pem
 */

const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");

function generateLicenseKey({ email, tier, durationDays, privateKeyPem }) {
  let normalizedTier = "pro_yearly";
  let defaultDays = 365;

  if (tier === "monthly" || tier === "pro_monthly") {
    normalizedTier = "pro_monthly";
    defaultDays = 30;
  } else if (tier === "lifetime" || tier === "pro_lifetime") {
    normalizedTier = "pro_lifetime";
    defaultDays = null;
  }

  const payload = {
    tier: normalizedTier,
    email: email ? email.trim().toLowerCase() : undefined,
    issuedAt: new Date().toISOString(),
  };

  if (normalizedTier !== "pro_lifetime") {
    const days = durationDays || defaultDays;
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    payload.expiresAt = expiresAt.toISOString();
  }

  const payloadJson = JSON.stringify(payload);
  const payloadBytes = Buffer.from(payloadJson, "utf8");
  const payloadB64 = payloadBytes.toString("base64");

  const signature = crypto.sign("sha256", payloadBytes, privateKeyPem).toString("base64url");

  const licenseKey = `MLD-PRO-${payloadB64}.${signature}`;

  return {
    licenseKey,
    payload,
  };
}

module.exports = { generateLicenseKey };

if (require.main === module) {
  // Parse CLI args
  const args = process.argv.slice(2);
  let email = "";
  let tier = "lifetime";
  let days = null;
  let keyPath = process.env.MLD_LICENSE_PRIVATE_KEY_PATH
    || path.join(os.homedir(), ".mylifedock", "license-signing-private-key.pem");

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
    } else if (args[i] === "--key" && args[i + 1]) {
      keyPath = args[i + 1];
      i++;
    }
  }

  if (!email) {
    console.error("Missing --email <customer email>.");
    process.exit(1);
  }

  if (!fs.existsSync(keyPath)) {
    console.error(`Signing key not found at ${keyPath}.`);
    console.error("Create one with: node scripts/generate-license-keypair.cjs");
    process.exit(1);
  }

  const result = generateLicenseKey({
    email,
    tier,
    durationDays: days,
    privateKeyPem: fs.readFileSync(keyPath, "utf8"),
  });

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
}

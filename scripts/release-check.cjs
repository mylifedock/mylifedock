#!/usr/bin/env node

/**
 * MyLifeDock pre-release gate.
 *
 * Run before building store releases:  npm run release:check
 * Exits non-zero if any release blocker is found. Checks configuration only;
 * run lint, tests and builds separately.
 */

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");
const exists = (rel) => fs.existsSync(path.join(root, rel));

const results = [];
function check(name, fn) {
  try {
    const problem = fn();
    results.push({ name, ok: !problem, detail: problem || "" });
  } catch (error) {
    results.push({ name, ok: false, detail: error.message });
  }
}

const pkgVersion = JSON.parse(read("package.json")).version;

check(`Version ${pkgVersion} is used by every platform`, () => {
  const problems = [];
  const tauri = JSON.parse(read("src-tauri/tauri.conf.json"));
  if (tauri.version !== "../package.json" && tauri.version !== pkgVersion) problems.push(`tauri.conf.json version is ${tauri.version}`);
  const cargo = read("src-tauri/Cargo.toml").match(/^version\s*=\s*"([^"]+)"/m);
  if (!cargo || cargo[1] !== pkgVersion) problems.push(`Cargo.toml version is ${cargo && cargo[1]}`);
  if (!/JsonSlurper\(\)\.parse\(file\('\.\.\/\.\.\/package\.json'\)\)/.test(read("android/app/build.gradle"))) {
    problems.push("android/app/build.gradle does not read the version from package.json");
  }
  const ios = [...read("ios/App/App.xcodeproj/project.pbxproj").matchAll(/MARKETING_VERSION = ([^;]+);/g)].map((m) => m[1]);
  if (ios.length === 0 || ios.some((v) => v !== pkgVersion)) problems.push(`iOS MARKETING_VERSION is ${ios.join(", ")}`);
  return problems.join("; ");
});

const PLAN_IDS = ["pro_monthly", "pro_yearly", "pro_lifetime"];
const rupees = (text) => Number(String(text).replace(/[^\d]/g, ""));

check("Live pricing service and website checkout are configured (Pricing tab via Apps Script)", () => {
  const problems = [];
  const cfg = read("src/config/pricingConfig.ts");
  const site = read("docs/assets/pricing.js");
  const appApi = (cfg.match(/export const PRICING_API_URL = "([^"]*)"/) || [])[1];
  const siteApi = (site.match(/var PRICING_API_URL = "([^"]*)"/) || [])[1];
  if (appApi === undefined || siteApi === undefined) problems.push("PRICING_API_URL not found in pricingConfig.ts or docs/assets/pricing.js");
  else if (appApi !== siteApi) problems.push(`PRICING_API_URL differs: app ${appApi || "(empty)"} vs website ${siteApi || "(empty)"}`);
  else if (!appApi) problems.push("PRICING_API_URL is empty: set the Apps Script Web App URL (…/exec) in src/config/pricingConfig.ts and docs/assets/pricing.js");
  else if (!/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(appApi)) problems.push(`PRICING_API_URL is not an Apps Script Web App URL: ${appApi}`);

  const pagesBlock = (site.match(/var PAYMENT_PAGES = \{([^}]+)\}/) || [])[1] || "";
  const pages = Object.fromEntries([...pagesBlock.matchAll(/(pro_\w+):\s*"([^"]+)"/g)].map((m) => [m[1], m[2]]));
  const urls = PLAN_IDS.map((id) => pages[id]);
  if (urls.some((u) => !u || !/^https:\/\/(rzp\.io|pages\.razorpay\.com)\//.test(u))) problems.push("docs/assets/pricing.js needs a backup Razorpay Payment Page for every plan");
  else if (new Set(urls).size !== urls.length) problems.push("backup Payment Pages are shared between plans");

  const checkout = (cfg.match(/export const CHECKOUT_PAGE_URL = "([^"]+)"/) || [])[1] || "";
  if (!/^https:\/\/[^/]+\/buy\.html$/.test(checkout) || !exists("docs/buy.html")) problems.push(`CHECKOUT_PAGE_URL (${checkout}) must point to docs/buy.html on the website`);

  const landing = read("docs/landing.html");
  for (const id of PLAN_IDS) {
    const btn = id.replace("pro_", "");
    const href = (landing.match(new RegExp(`id="${btn}-buy-btn" href="([^"]+)"`)) || [])[1];
    if (href !== `buy.html?plan=${id}`) problems.push(`landing ${btn} button goes to ${href} instead of buy.html?plan=${id}`);
  }
  if (read("docs/index.html") !== landing) problems.push("docs/index.html differs from docs/landing.html (copy landing.html over index.html)");
  if (!read("tools/admin.html").includes(`const CHECKOUT_PAGE_URL = "${checkout}"`)) problems.push("tools/admin.html CHECKOUT_PAGE_URL differs from the app");
  return problems.join("; ");
});

check("Regular prices match in the app, website, checkout, admin tool and Apps Script defaults", () => {
  const problems = [];
  const app = {};
  for (const m of read("src/config/pricingConfig.ts").matchAll(/id:\s*"(pro_\w+)"[\s\S]*?priceINR:\s*"(₹[\d,]+)"/g)) app[m[1]] = rupees(m[2]);
  const block = (read("scripts/razorpay-auto-mailer.gs").match(/var DEFAULT_PRICES_INR = \{([^}]+)\}/) || [])[1] || "";
  const sources = {
    "Apps Script DEFAULT_PRICES_INR": Object.fromEntries([...block.matchAll(/(pro_\w+):\s*(\d+)/g)].map((m) => [m[1], Number(m[2])])),
    "docs/landing.html": Object.fromEntries([...read("docs/landing.html").matchAll(/data-plan-price="(pro_\w+)" data-price-inr="([^"]+)"/g)].map((m) => [m[1], rupees(m[2])])),
    "docs/buy.html": Object.fromEntries([...read("docs/buy.html").matchAll(/data-choice-price="(pro_\w+)">([^<]+)</g)].map((m) => [m[1], rupees(m[2])])),
    "tools/admin.html": Object.fromEntries([...read("tools/admin.html").matchAll(/(pro_\w+): \{[^}]*\binr: (\d+)/g)].map((m) => [m[1], Number(m[2])])),
  };
  for (const id of PLAN_IDS) {
    if (!app[id]) problems.push(`${id} has no price in pricingConfig.ts`);
    for (const [name, prices] of Object.entries(sources)) {
      if (prices[id] !== app[id]) problems.push(`${id}: ${name} ₹${prices[id]} vs app ₹${app[id]}`);
    }
  }
  return problems.join("; ");
});
check("License public key is configured and valid", () => {
  const key = (read("src/config/licenseConfig.ts").match(/"([A-Za-z0-9+/=]{300,})"/) || [])[1];
  if (!key) return "LICENSE_PUBLIC_KEY_SPKI is empty";
  crypto.createPublicKey({ key: Buffer.from(key, "base64"), format: "der", type: "spki" });
  const admin = read("tools/admin.html");
  if (!admin.includes(key)) return "tools/admin.html uses a different public key (re-run generate-license-keypair.cjs)";
  return "";
});

check("No private keys or retired secrets in the repository", () => {
  const offenders = [];
  const skip = new Set(["node_modules", "dist", ".git", "target", "build", ".gradle", "Pods", "test-results"]);
  const retired = ["MLD-Founder-2026!", "mld_vault_sovereign_signature_2026_secure"];
  (function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (skip.has(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) { walk(full); continue; }
      if (fs.statSync(full).size > 2_000_000) continue;
      const text = fs.readFileSync(full, "utf8");
      const rel = path.relative(root, full);
      if (/-----BEGIN (RSA |EC )?PRIVATE KEY-----\s*\n[A-Za-z0-9+/]{40}/.test(text)) offenders.push(`${rel} (private key)`);
      if (rel !== path.join("scripts", "release-check.cjs") && !rel.startsWith("tests") && retired.some((s) => text.includes(s))) offenders.push(`${rel} (retired secret)`);
    }
  })(root);
  return offenders.join(", ");
});

check("Privacy policy and terms are bundled and published", () => {
  const missing = ["public/privacy.html", "public/terms.html", "docs/privacy.html", "docs/terms.html"].filter((f) => !exists(f));
  return missing.length ? `missing ${missing.join(", ")}` : "";
});

check("Admin portal is not deployed", () => {
  const deployed = ["public/admin.html", "docs/admin.html"].filter(exists);
  return deployed.length ? `found ${deployed.join(", ")}` : "";
});

check("Android manifest is store-ready", () => {
  const manifest = read("android/app/src/main/AndroidManifest.xml");
  const problems = [];
  if (manifest.includes('android:name="android.permission.USE_EXACT_ALARM"')) problems.push("requests USE_EXACT_ALARM");
  if (!manifest.includes('android:allowBackup="false"')) problems.push("allowBackup is not false");
  if (!manifest.includes("@xml/data_extraction_rules") || !exists("android/app/src/main/res/xml/data_extraction_rules.xml")) problems.push("missing data extraction rules");
  if (!read("android/app/src/main/java/com/mylifedock/app/MainActivity.java").includes("FLAG_SECURE")) problems.push("FLAG_SECURE not set");
  return problems.join("; ");
});

check("iOS declares every permission the app uses", () => {
  const plist = read("ios/App/App/Info.plist");
  const missing = ["NSCameraUsageDescription", "NSPhotoLibraryUsageDescription", "NSFaceIDUsageDescription"]
    .filter((k) => !plist.includes(`<key>${k}</key>`));
  const problems = missing.length ? [`missing ${missing.join(", ")}`] : [];
  // Voice search was removed; asking for these permissions without using them gets apps rejected.
  const unused = ["NSMicrophoneUsageDescription", "NSSpeechRecognitionUsageDescription"].filter((k) => plist.includes(`<key>${k}</key>`));
  if (unused.length) problems.push(`requests unused ${unused.join(", ")}`);
  if (!read("ios/App/App/SceneDelegate.swift").includes("sceneWillResignActive")) problems.push("no app-switcher privacy cover");
  return problems.join("; ");
});

function cspDirective(csp, name) {
  const match = csp.split(";").map((d) => d.trim()).find((d) => d.startsWith(`${name} `) || d === name);
  return match ? match.split(/\s+/).slice(1) : [];
}

check("Desktop CSP allows the IPC bridge, Google token exchange, live prices and PDF preview", () => {
  const desktop = JSON.parse(read("src-tauri/tauri.conf.json")).app.security.csp || "";
  // Tauri enforces its policy and the index.html meta policy together, so both must allow these.
  const meta = (read("index.html").match(/http-equiv="Content-Security-Policy" content="([^"]+)"/) || [])[1] || "";
  const problems = [];
  for (const [label, csp] of [["tauri.conf.json", desktop], ["index.html", meta]]) {
    const connect = cspDirective(csp, "connect-src");
    for (const origin of ["ipc:", "http://ipc.localhost", "https://oauth2.googleapis.com", "https://www.googleapis.com", "https://script.google.com", "https://script.googleusercontent.com"]) {
      if (!connect.includes(origin)) problems.push(`${label} connect-src lacks ${origin}`);
    }
    if (!cspDirective(csp, "frame-src").includes("blob:")) problems.push(`${label} frame-src lacks blob:`);
    if (!cspDirective(csp, "object-src").includes("'none'")) problems.push(`${label} object-src is not 'none'`);
  }
  if (/accounts\.google\.com/.test(desktop)) problems.push("tauri.conf.json still allows accounts.google.com (desktop signs in through the system browser)");
  return problems.join("; ");
});

check("Desktop ships only the NSIS .exe installer", () => {
  const targets = JSON.parse(read("src-tauri/tauri.conf.json")).bundle.targets;
  return JSON.stringify(targets) === JSON.stringify(["nsis"]) ? "" : `bundle.targets is ${JSON.stringify(targets)}`;
});

check("App bundle contains no website-only files", () => {
  const allowed = new Set(["favicon.svg", "pwa-192x192.png", "privacy.html", "terms.html"]);
  const extra = fs.readdirSync(path.join(root, "public")).filter((f) => !allowed.has(f));
  return extra.length ? `public/ also contains ${extra.join(", ")} (website files belong in docs/)` : "";
});

check("Android FileProvider exposes only the share folder", () => {
  const paths = read("android/app/src/main/res/xml/file_paths.xml");
  const problems = [];
  if (/<(external|external-files|root|files)-path/.test(paths)) problems.push("exposes storage beyond the cache share folder");
  if (!/<cache-path[^>]*path="mld-share\/"/.test(paths)) problems.push("cache-path is not limited to mld-share/");
  return problems.join("; ");
});

/** Build-time values from the environment or .env (values are never printed). */
function buildEnv(name) {
  if (process.env[name]) return process.env[name];
  if (!exists(".env")) return "";
  const line = read(".env").split(/\r?\n/).find((l) => l.trim().startsWith(`${name}=`));
  return line ? line.slice(line.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "") : "";
}

const notes = [];

check("In-app purchase products are valid for Google Play and the App Store", () => {
  const cfg = read("src/config/storeProducts.ts");
  const ids = [...cfg.matchAll(/productId:\s*"([^"]+)"/g)].map((m) => m[1]);
  const plans = [...cfg.matchAll(/plan:\s*"([^"]+)"/g)].map((m) => m[1]);
  const problems = [];
  if (ids.length !== 3) problems.push(`expected 3 store products, found ${ids.length}`);
  if (new Set(plans).size !== plans.length) problems.push("two store products map to the same plan");
  // Play: lowercase letter/number first, then a-z 0-9 _ . ; App Store accepts the same.
  for (const id of ids) if (!/^[a-z0-9][a-z0-9_.]{0,138}$/.test(id)) problems.push(`invalid product id "${id}"`);
  for (const base of [...cfg.matchAll(/androidBasePlanId:\s*"([^"]+)"/g)].map((m) => m[1])) {
    if (!/^[a-z0-9][a-z0-9-]{0,62}$/.test(base)) problems.push(`invalid Play base plan id "${base}"`);
  }
  if (!/STORE_PRODUCTS_LIVE\s*=\s*true/.test(cfg)) {
    notes.push("Billing: STORE_PRODUCTS_LIVE is false, so the Android/iOS apps show \"coming soon\" instead of a Buy button.");
  }
  return problems.join("; ");
});
check("Google sign-in configuration is consistent per platform", () => {
  const problems = [];
  const social = read("capacitor.config.ts");
  if (!/facebook:\s*false/.test(social)) problems.push("capacitor.config.ts bundles the Facebook SDK");
  if (/codetrix-studio/.test(read("package.json"))) problems.push("the unmaintained @codetrix-studio/capacitor-google-auth plugin is still installed");

  const iosClient = buildEnv("VITE_GOOGLE_IOS_CLIENT_ID");
  if (iosClient) {
    const reversed = iosClient.split(".").reverse().join(".");
    if (!read("ios/App/App/Info.plist").includes(`<string>${reversed}</string>`)) {
      problems.push("VITE_GOOGLE_IOS_CLIENT_ID is set but its reversed ID is not a CFBundleURLSchemes entry in Info.plist (Google sign-in would crash)");
    }
  } else {
    notes.push("iOS: VITE_GOOGLE_IOS_CLIENT_ID not set, so Drive backup is hidden in the iOS app.");
  }
  if (!buildEnv("VITE_GOOGLE_DESKTOP_CLIENT_ID") || !buildEnv("VITE_GOOGLE_DESKTOP_CLIENT_SECRET")) {
    notes.push("Windows: VITE_GOOGLE_DESKTOP_CLIENT_ID / _SECRET not set, so Drive backup is hidden in the desktop app.");
  }
  return problems.join("; ");
});
let failed = 0;
for (const r of results) {
  if (!r.ok) failed++;
  console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name}${r.ok ? "" : `\n      -> ${r.detail}`}`);
}
for (const note of notes) console.log(`NOTE  ${note}`);
console.log(`\n${results.length - failed}/${results.length} checks passed.`);
process.exit(failed ? 1 : 0);

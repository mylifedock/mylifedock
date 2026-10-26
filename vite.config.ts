import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { createReadStream, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

/**
 * Self-hosts the Tesseract OCR worker, WASM cores and English language data
 * under /tesseract/. By default tesseract.js downloads these from jsdelivr,
 * which the app's CSP blocks (and which would break offline use).
 */
function selfHostedOcrAssets(): Plugin {
  const require = createRequire(import.meta.url);
  const tesseractDir = path.dirname(require.resolve("tesseract.js/package.json"));
  const coreDir = path.dirname(require.resolve("tesseract.js-core/package.json"));
  const langDir = path.dirname(require.resolve("@tesseract.js-data/eng/package.json"));

  // Served path (under /tesseract/) -> source file. Only the LSTM cores are
  // needed because the worker runs with OEM 1 (LSTM only).
  // The source paths are fixed files inside node_modules, never request input.
  const assets = new Map<string, string>([
    ["worker.min.js", path.join(tesseractDir, "dist", "worker.min.js")],
    ["core/tesseract-core-lstm.wasm.js", path.join(coreDir, "tesseract-core-lstm.wasm.js")],
    ["core/tesseract-core-simd-lstm.wasm.js", path.join(coreDir, "tesseract-core-simd-lstm.wasm.js")],
    ["core/tesseract-core-relaxedsimd-lstm.wasm.js", path.join(coreDir, "tesseract-core-relaxedsimd-lstm.wasm.js")],
    ["lang/eng.traineddata.gz", path.join(langDir, "4.0.0_best_int", "eng.traineddata.gz")],
  ]);

  return {
    name: "mld-self-hosted-ocr-assets",
    configureServer(server) {
      server.middlewares.use("/tesseract/", (req, res, next) => {
        const key = decodeURIComponent((req.url ?? "").split("?")[0].replace(/^\//, ""));
        const source = assets.get(key);
        if (!source) return next();
        res.setHeader("Content-Type", key.endsWith(".gz") ? "application/gzip" : "text/javascript");
        // eslint-disable-next-line security/detect-non-literal-fs-filename -- fixed path from the allow-list above
        createReadStream(source).pipe(res);
      });
    },
    generateBundle() {
      for (const [servedPath, source] of assets) {
        // eslint-disable-next-line security/detect-non-literal-fs-filename -- fixed path from the allow-list above
        this.emitFile({ type: "asset", fileName: `tesseract/${servedPath}`, source: readFileSync(source) });
      }
    },
  };
}

/**
 * The shipped apps sign in to Google natively (mobile) or in the system browser
 * (desktop), so production builds drop the Google Identity Services script,
 * style and frame allowances that only the browser development build uses.
 */
function productionCsp(): Plugin {
  return {
    name: "mld-production-csp",
    apply: "build",
    transformIndexHtml(html) {
      const tightened = html.replace(/ https:\/\/accounts\.google\.com/g, "");
      if (!tightened.includes('http-equiv="Content-Security-Policy"')) {
        throw new Error("index.html must keep its Content-Security-Policy meta tag");
      }
      return tightened;
    },
  };
}

// eslint-disable-next-line security/detect-non-literal-fs-filename -- this project's own package.json
const appVersion: string = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")).version;

export default defineConfig({
  // Prevent vite from hiding Rust compile errors in Tauri builds
  clearScreen: false,

  // package.json is the single source of truth for the app version.
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
  },

  server: {
    // Tauri expects a fixed port — do not change
    port: 5173,
    // Allow all origins so Tauri webview can connect
    host: true,
    // Fail if port is already in use (avoid silent port switching)
    strictPort: true,
  },

  // Env vars starting with VITE_ are exposed to the frontend.
  // TAURI_ prefixed vars are also available in Tauri context.
  envPrefix: ["VITE_", "TAURI_ENV_"],

  build: {
    // No source maps in shipped apps: they would publish the readable source inside every installer.
    sourcemap: false,
    // Supported by Android System WebView, iOS WKWebView (iOS 15+) and Windows WebView2.
    target: "es2022",
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes("node_modules/react/") || id.includes("node_modules/react-dom/")) {
            return "vendor-react";
          }
          if (id.includes("node_modules/dexie") || id.includes("node_modules/dexie-react-hooks")) {
            return "vendor-dexie";
          }
          if (id.includes("node_modules/@capacitor/") || id.includes("node_modules/@aparajita/") || id.includes("node_modules/@capgo/")) {
            return "vendor-capacitor";
          }
        },
      },
    },
    chunkSizeWarningLimit: 800,
  },

  plugins: [
    react(),
    selfHostedOcrAssets(),
    productionCsp(),
  ],
});
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// Detect if we're being run inside Tauri dev mode.
// Tauri sets this env var when running `tauri dev`.
const isTauriBuild = process.env.TAURI_ENV_TARGET_TRIPLE !== undefined;

export default defineConfig({
  // Prevent vite from hiding Rust compile errors in Tauri builds
  clearScreen: false,

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
    // Produce source maps for tauri builds (helps debug Rust ↔ JS boundary)
    sourcemap: isTauriBuild ? true : false,
    // Modern ECMAScript target supported by all modern browsers, Android/iOS WebViews, and desktop WebView2/WebKit
    target: "es2022",
  },

  plugins: [
    react(),
    // Only enable PWA plugin for web/mobile builds, not Tauri desktop
    ...(isTauriBuild
      ? []
      : [
          VitePWA({
            registerType: "autoUpdate",
            includeAssets: [
              "favicon.svg",
            ],
            manifest: {
              name: "MyLifeDock",
              short_name: "MyLifeDock",
              description:
                "Privacy-first personal and family life management vault",
              theme_color: "#0a0e1a",
              background_color: "#0a0e1a",
              display: "standalone",
              orientation: "portrait",
              scope: "/",
              start_url: "/",
              icons: [
                {
                  src: "pwa-192x192.png",
                  sizes: "192x192",
                  type: "image/png",
                },
                {
                  src: "pwa-512x512.png",
                  sizes: "512x512",
                  type: "image/png",
                },
                {
                  src: "pwa-512x512.png",
                  sizes: "512x512",
                  type: "image/png",
                  purpose: "any maskable",
                },
              ],
            },
            workbox: {
              globPatterns: [
                "**/*.{js,css,html,ico,png,svg}",
              ],
              runtimeCaching: [
                {
                  urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
                  handler: "CacheFirst",
                  options: {
                    cacheName: "google-fonts-cache",
                    expiration: {
                      maxEntries: 10,
                      maxAgeSeconds:
                        60 * 60 * 24 * 365,
                    },
                  },
                },
              ],
            },
          }),
        ]),
  ],
});


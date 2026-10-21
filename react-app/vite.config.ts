/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// GitHub Pages project site: base MUST equal "/<RepoName>/".
const BASE = "/Retro/";

// https://vitejs.dev/config/
export default defineConfig(() => {
  return {
    base: BASE,
    define: {
      __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    },
    server: {
      // In dev the OAuth code exchange goes to the relay Worker running under
      // `npm run dev` in ../relay (wrangler dev, port 8787). The client calls a
      // relative /auth/* so the same build works on Pages with VITE_API_BASE set.
      proxy: {
        "/auth": {
          target: "http://127.0.0.1:8787",
          changeOrigin: true,
        },
      },
    },
    plugins: [
      react(),
      VitePWA({
        registerType: "autoUpdate",
        includeAssets: ["favicon.png", "icons/apple-touch-icon.png"],
        manifest: {
          name: "Retro",
          short_name: "Retro",
          description:
            "Sprint retrospectives for GitHub teams: sticky-note board stored as a GitHub Discussion, action items promoted to issues on the team's Project.",
          theme_color: "#0f1419",
          background_color: "#0f1419",
          display: "standalone",
          scope: BASE,
          start_url: BASE,
          icons: [
            { src: "icons/pwa-192.png", sizes: "192x192", type: "image/png" },
            { src: "icons/pwa-512.png", sizes: "512x512", type: "image/png" },
            {
              src: "icons/maskable-512.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "maskable",
            },
          ],
        },
        workbox: {
          globPatterns: ["**/*.{js,css,html,png,svg,json}"],
          maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
          // Never cache GitHub API or auth responses.
          navigateFallbackDenylist: [/^\/auth\//, /^\/api\//],
        },
      }),
    ],
    test: {
      environment: "node",
      include: ["src/**/*.test.ts"],
    },
  };
});

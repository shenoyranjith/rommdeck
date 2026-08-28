import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import electron from "vite-plugin-electron/simple";
import path from "node:path";
import { cpSync, existsSync, mkdirSync } from "node:fs";

function copyElectronAssets(): Plugin {
  return {
    name: "copy-electron-assets",
    closeBundle() {
      const outDir = path.resolve(__dirname, "dist-electron");
      mkdirSync(outDir, { recursive: true });
      const icon256 = path.resolve(__dirname, "assets/icon-256.png");
      if (existsSync(icon256)) {
        cpSync(icon256, path.join(outDir, "icon.png"));
      }
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    electron({
      main: {
        entry: "electron/main.ts",
        onstart(args) {
          // Full restart only when main process code changes
          args.startup();
        },
        vite: {
          plugins: [copyElectronAssets()],
          build: {
            outDir: "dist-electron",
            rollupOptions: {
              // Keep core external so editing packages/core or the renderer
              // does not rebuild/restart Electron (avoids a new window per save).
              external: ["better-sqlite3", "electron", "@rommdeck/core"],
            },
          },
        },
      },
      preload: {
        input: "electron/preload.ts",
        onstart(args) {
          // Refresh renderer only — do not spawn a new Electron process
          args.reload();
        },
        vite: {
          build: {
            outDir: "dist-electron",
            rollupOptions: {
              output: {
                format: "cjs",
                entryFileNames: "preload.js",
                inlineDynamicImports: true,
              },
            },
          },
        },
      },
      renderer: {},
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  server: {
    port: 5173,
  },
  build: {
    outDir: "dist",
  },
});

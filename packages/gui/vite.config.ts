import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import electron from "vite-plugin-electron/simple";
import path from "node:path";

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

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { viteSingleFile } from "vite-plugin-singlefile";

/**
 * Single-file build: `npm run build:single` → dist-single/index.html.
 * Everything (JS, CSS, the pdf.js "worker", the sample plan PDF) is inlined
 * into one HTML file that can be opened by double-clicking — no server needed.
 */
export default defineConfig({
  plugins: [react(), tailwindcss(), viteSingleFile()],
  optimizeDeps: { exclude: ["pdfjs-dist"] },
  resolve: { dedupe: ["three"] },
  build: {
    outDir: "dist-single",
    // inline every asset (incl. the 0.8MB sample plan) as data-URIs
    assetsInlineLimit: 100_000_000,
    chunkSizeWarningLimit: 10_000,
  },
});

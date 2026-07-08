import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 5173 },
  // pdf.js must not be pre-bundled: the optimized copy and the module worker
  // end up as two different instances and page.render() never resolves.
  optimizeDeps: { exclude: ["pdfjs-dist"] },
  resolve: { dedupe: ["three"] },
});

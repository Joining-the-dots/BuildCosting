/// <reference types="vite/client" />

// pdf.js ships no types for the worker entry; we import it for its side
// effect (main-thread "fake worker") only.
declare module "pdfjs-dist/build/pdf.worker.min.mjs";

declare module "*.pdf" {
  const url: string;
  export default url;
}

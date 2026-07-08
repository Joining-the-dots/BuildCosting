import * as pdfjs from "pdfjs-dist";
// Import the worker module onto the main thread instead of spawning a Web
// Worker. pdf.js detects `globalThis.pdfjsWorker` and skips loading workerSrc
// entirely — this is what lets the whole app ship as ONE self-contained HTML
// file (a real Worker needs a separate script URL, which file:// can't serve).
// Parsing an 8-page plan on the main thread takes well under a second.
import * as pdfjsWorker from "pdfjs-dist/build/pdf.worker.min.mjs";
import type { Confidence, PageKind, PlanPage } from "../types";

(globalThis as { pdfjsWorker?: unknown }).pdfjsWorker = pdfjsWorker;

export type PdfDoc = pdfjs.PDFDocumentProxy;

/** Load a PDF from a data-URL (how we persist the upload in localStorage). */
export async function loadPdf(dataUrl: string): Promise<PdfDoc> {
  const base64 = dataUrl.split(",")[1];
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  return pdfjs.getDocument({ data: bytes }).promise;
}

/** Render one page to a PNG data-URL at a target CSS width. */
export async function renderPage(pdf: PdfDoc, pageIndex: number, targetWidth: number): Promise<string> {
  const page = await pdf.getPage(pageIndex + 1);
  const base = page.getViewport({ scale: 1 });
  const scale = targetWidth / base.width;
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const ctx = canvas.getContext("2d")!;
  // intent: "print" — the default display intent schedules canvas work on
  // requestAnimationFrame, which never fires in a hidden/background tab and
  // leaves render() hanging forever. Print intent renders immediately.
  await page.render({ canvasContext: ctx, viewport, intent: "print" }).promise;
  return canvas.toDataURL("image/png");
}

/** Pull the full text layer of a page (architect PDFs are usually vector text). */
export async function extractPageText(pdf: PdfDoc, pageIndex: number): Promise<string> {
  const page = await pdf.getPage(pageIndex + 1);
  const content = await page.getTextContent();
  return content.items
    .map((it) => ("str" in it ? it.str : ""))
    .join("\n");
}

/**
 * Classify a page from its text. This is REAL detection (not mocked): it looks
 * for title-block phrases like "Proposed Ground Floor" / "Section" / "Elevation".
 */
export function classifyPage(text: string): { kind: PageKind; label: string; confidence: Confidence } {
  const t = text.replace(/\s+/g, " ");
  const rules: Array<{ re: RegExp; kind: PageKind; label: string }> = [
    { re: /(proposed|existing)?\s*ground\s*floor/i, kind: "ground", label: "Ground Floor Plan" },
    { re: /(proposed|existing)?\s*first\s*floor/i, kind: "first", label: "First Floor Plan" },
    { re: /(proposed|existing)?\s*roof(\s*plan)?/i, kind: "roof", label: "Roof Plan" },
    { re: /elevation/i, kind: "elevation", label: "Elevation" },
    { re: /section\s*[a-c]?/i, kind: "section", label: "Section" },
  ];
  for (const rule of rules) {
    const m = t.match(rule.re);
    if (m) {
      // Prefer the actual drawing title if present, e.g. "Proposed Ground Floor".
      const title = t.match(
        /proposed\s+(ground\s+floor|first\s+floor|roof(\s+plan)?|front\s+elevation|rear\s+elevation|elevation|section\s+[a-z]?)/i,
      )?.[0]?.trim();
      return { kind: rule.kind, label: title ?? rule.label, confidence: "high" };
    }
  }
  return { kind: "ignore", label: "Unclassified page", confidence: "low" };
}

/** Try to find a scale note like "1:50 @ A3" anywhere in the document text. */
export function findScaleNote(pageTexts: string[]): string {
  for (const t of pageTexts) {
    const m = t.replace(/\s+/g, " ").match(/1\s*:\s*\d{2,3}\s*@?\s*A\d/i);
    if (m) return m[0].replace(/\s+/g, " ").toUpperCase();
  }
  return "";
}

/** Build the PlanPage array for an uploaded file: thumbnails + text + auto-kind. */
export async function analysePdf(
  pdf: PdfDoc,
  onProgress?: (done: number, total: number) => void,
): Promise<PlanPage[]> {
  const pages: PlanPage[] = [];
  for (let i = 0; i < pdf.numPages; i++) {
    const [text, thumbnail] = await Promise.all([
      extractPageText(pdf, i),
      renderPage(pdf, i, 280),
    ]);
    const { kind, label, confidence } = classifyPage(text);
    pages.push({
      index: i,
      label,
      kind,
      autoKind: kind,
      autoConfidence: confidence,
      text,
      thumbnail,
    });
    onProgress?.(i + 1, pdf.numPages);
  }
  return pages;
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

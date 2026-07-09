import { useCallback, useEffect, useRef, useState } from "react";
import { FileUp, Loader2, ScanSearch, FileCheck2 } from "lucide-react";
import { useStore } from "../store";
import { analysePdf, fileToDataUrl, findScaleNote, loadPdf, renderPage } from "../lib/pdf";
// Bundled as an asset: a dev URL normally, an embedded data-URI in the
// single-file build (assetsInlineLimit is raised there).
import samplePlanUrl from "../assets/sample-plan.pdf";
import { extractRooms, demoRooms } from "../lib/extraction";
import type { PageKind } from "../types";
import { Card, ConfidenceBadge } from "../components/ui";

const KIND_OPTIONS: Array<{ value: PageKind; label: string }> = [
  { value: "ground", label: "Ground floor" },
  { value: "first", label: "First floor" },
  { value: "roof", label: "Roof plan" },
  { value: "elevation", label: "Elevation" },
  { value: "section", label: "Section" },
  { value: "ignore", label: "Ignore" },
];

const KIND_COLORS: Record<PageKind, string> = {
  ground: "border-emerald-400 ring-emerald-100",
  first: "border-sky-400 ring-sky-100",
  roof: "border-stone-300 ring-stone-100",
  elevation: "border-stone-300 ring-stone-100",
  section: "border-stone-300 ring-stone-100",
  ignore: "border-stone-200 ring-transparent opacity-60",
};

export default function UploadScreen() {
  const plan = useStore((s) => s.plan);
  const setPlan = useStore((s) => s.setPlan);
  const setPageKind = useStore((s) => s.setPageKind);
  const setDraftRooms = useStore((s) => s.setDraftRooms);
  const setScreen = useStore((s) => s.setScreen);
  const logChange = useStore((s) => s.logChange);
  const setProjectName = useStore((s) => s.setProjectName);

  const [busy, setBusy] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [activePage, setActivePage] = useState(0);
  const [preview, setPreview] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  /** Ingest a PDF: render thumbnails, read the text layer, auto-classify pages. */
  const ingest = useCallback(
    async (dataUrl: string, fileName: string) => {
      try {
        setBusy("Reading PDF…");
        const pdf = await loadPdf(dataUrl);
        setBusy(`Analysing ${pdf.numPages} pages…`);
        const pages = await analysePdf(pdf, (done, total) => setBusy(`Analysing page ${done}/${total}…`));
        const scaleNote = findScaleNote(pages.map((p) => p.text));
        setPlan({
          fileName,
          numPages: pdf.numPages,
          dataUrl,
          pages,
          scaleNote,
          uploadedAt: new Date().toISOString(),
        });
        // Try to name the project from the title block (e.g. "21 Thornton Road").
        // Whitespace is collapsed first (pdf.js splits words across lines);
        // negative lookbehind excludes neighbour labels like "44/45/46 Denmark Road".
        const addr = pages[0]?.text
          .replace(/\s+/g, " ")
          .match(/(?<![/\d])\d+[a-z]?\s+[A-Z][a-z]+\s+(Road|Street|Lane|Avenue|Close|Drive|Gardens)/);
        if (addr) setProjectName(addr[0]);
        setActivePage(pages.findIndex((p) => p.kind === "ground") >= 0 ? pages.findIndex((p) => p.kind === "ground") : 0);
        logChange(`Uploaded plan "${fileName}" (${pdf.numPages} pages)`);
      } catch (err) {
        console.error(err);
        alert("Could not read that PDF. Is it a valid file?");
      } finally {
        setBusy(null);
      }
    },
    [setPlan, logChange, setProjectName],
  );

  const onFile = useCallback(
    async (file: File) => {
      if (!file.name.toLowerCase().endsWith(".pdf")) {
        alert("Please upload a PDF plan.");
        return;
      }
      const dataUrl = await fileToDataUrl(file);
      await ingest(dataUrl, file.name);
    },
    [ingest],
  );

  const loadSample = useCallback(async () => {
    setBusy("Fetching sample plan…");
    let dataUrl: string;
    if (samplePlanUrl.startsWith("data:")) {
      // single-file build: the PDF is already embedded as a data-URI
      dataUrl = samplePlanUrl;
    } else {
      const res = await fetch(samplePlanUrl);
      const blob = await res.blob();
      dataUrl = await fileToDataUrl(new File([blob], "sample.pdf"));
    }
    await ingest(dataUrl, "PL_020 - Proposed_planning.pdf");
  }, [ingest]);

  // Render the large preview of the active page on demand.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!plan) return setPreview(null);
      const pdf = await loadPdf(plan.dataUrl);
      const img = await renderPage(pdf, activePage, 1100);
      if (!cancelled) setPreview(img);
    })();
    return () => {
      cancelled = true;
    };
  }, [plan, activePage]);

  /** Run extraction over the pages currently marked ground/first. */
  const runExtraction = () => {
    if (!plan) return;
    const rooms = extractRooms(plan.pages);
    const result = rooms.length ? rooms : demoRooms();
    setDraftRooms(result);
    logChange(
      rooms.length
        ? `Extracted ${rooms.length} rooms from the plan text`
        : "No text layer found — loaded template room list to edit",
    );
    setScreen("confirm");
  };

  // ---------- render ----------

  if (!plan) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <div className="max-w-xl w-full text-center">
          <div
            className={`rounded-2xl border-2 border-dashed p-14 transition-colors cursor-pointer bg-white/60 ${
              dragOver ? "border-amber-400 bg-amber-50" : "border-stone-300 hover:border-amber-300"
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const f = e.dataTransfer.files?.[0];
              if (f) onFile(f);
            }}
            onClick={() => inputRef.current?.click()}
          >
            {busy ? (
              <Loader2 className="w-10 h-10 mx-auto text-amber-500 animate-spin" />
            ) : (
              <FileUp className="w-10 h-10 mx-auto text-stone-400" />
            )}
            <h2 className="mt-4 text-xl font-semibold text-stone-800">
              {busy ?? "Drop your architect plan here"}
            </h2>
            <p className="mt-1 text-sm text-stone-500">
              PDF plans — we'll read the pages, detect the floor plans and list the rooms.
            </p>
            <input
              ref={inputRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
            />
          </div>
          <button
            onClick={loadSample}
            disabled={!!busy}
            className="mt-5 text-sm text-amber-700 hover:text-amber-800 underline underline-offset-4"
          >
            or try the sample plan (21 Thornton Road)
          </button>
        </div>
      </div>
    );
  }

  const floorPages = plan.pages.filter((p) => p.kind === "ground" || p.kind === "first").length;

  return (
    <div className="h-full flex flex-col md:flex-row overflow-hidden">
      {/* pages: thumbnails + classification (top strip on phones, left rail on desktop) */}
      <div className="w-full md:w-80 shrink-0 max-h-[42vh] md:max-h-none border-b md:border-b-0 md:border-r border-stone-200 bg-white overflow-y-auto p-4">
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-semibold text-stone-800 text-sm">Pages</h2>
          <button onClick={() => setPlan(null)} className="text-xs text-stone-400 hover:text-rose-500">
            Replace PDF
          </button>
        </div>
        <p className="text-xs text-stone-500 mb-3">
          {plan.fileName} · {plan.numPages} pages
          {plan.scaleNote && <span className="ml-1 text-stone-400">· {plan.scaleNote}</span>}
        </p>
        <div className="grid grid-cols-2 md:grid-cols-1 gap-3">
          {plan.pages.map((p) => (
            <div
              key={p.index}
              className={`rounded-lg border-2 ring-4 ${KIND_COLORS[p.kind]} overflow-hidden cursor-pointer transition-all ${
                activePage === p.index ? "shadow-md" : ""
              }`}
              onClick={() => setActivePage(p.index)}
            >
              <img src={p.thumbnail} alt={p.label} className="w-full bg-white" />
              <div className="p-2 bg-stone-50 border-t border-stone-100">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[11px] font-medium text-stone-700 truncate">
                    p{p.index + 1} · {p.label}
                  </span>
                  <ConfidenceBadge level={p.autoConfidence} />
                </div>
                <select
                  value={p.kind}
                  onChange={(e) => setPageKind(p.index, e.target.value as PageKind)}
                  onClick={(e) => e.stopPropagation()}
                  className="mt-1.5 w-full text-xs border border-stone-300 rounded-md px-1.5 py-1 bg-white"
                >
                  {KIND_OPTIONS.map((k) => (
                    <option key={k.value} value={k.value}>
                      {k.label}
                      {p.autoKind === k.value ? " (auto-detected)" : ""}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* right: big preview + CTA */}
      <div className="flex-1 flex flex-col overflow-hidden bg-stone-100">
        <div className="flex-1 overflow-auto p-6 flex items-start justify-center">
          {preview ? (
            <img src={preview} alt="Plan preview" className="max-w-full rounded-lg shadow-lg border border-stone-200 bg-white" />
          ) : (
            <Loader2 className="w-8 h-8 text-stone-400 animate-spin mt-20" />
          )}
        </div>
        <div className="border-t border-stone-200 bg-white px-4 md:px-6 py-3 md:py-4 flex flex-col sm:flex-row gap-2.5 sm:items-center sm:justify-between">
          <div className="text-xs md:text-sm text-stone-600 flex items-center gap-2">
            <FileCheck2 className="w-4 h-4 text-emerald-500 shrink-0" />
            {floorPages} page{floorPages === 1 ? "" : "s"} marked as floor plans — room labels will be read from these.
          </div>
          <button
            onClick={runExtraction}
            disabled={floorPages === 0}
            className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-white font-semibold text-sm px-5 py-2.5 rounded-lg shadow-sm transition-colors"
          >
            <ScanSearch className="w-4 h-4" />
            Extract rooms
          </button>
        </div>
      </div>
    </div>
  );
}

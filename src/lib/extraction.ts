import type { Confidence, ExtractedRoom, FloorLevel, PlanPage } from "../types";
import { genericLayout, lookupLayout, resetGenericLayout } from "../data/layouts";

/**
 * Room-label extraction from the PDF text layer.
 *
 * This is real text matching, not a hard-coded list: it scans the text of
 * every page the user classified as a floor plan and picks out known room
 * words. Geometry is then synthesised from curated layouts (see layouts.ts) —
 * that part is the "mock" half, to be replaced by vector wall extraction.
 */

let idCounter = 0;
export function nextId(prefix = "room") {
  idCounter += 1;
  return `${prefix}_${Date.now().toString(36)}_${idCounter}`;
}

/**
 * Room vocabulary, most-specific first so "FRONT BEDROOM" wins over "BEDROOM".
 * `unique` labels are only matched once per page (a plan prints each room
 * label once); repeatable ones (BEDROOM, BATHROOM) can appear several times
 * but PDF text gives us no reliable count, so we also take them once per page.
 */
const ROOM_VOCAB: Array<{ re: RegExp; canonical: string; confidence: Confidence }> = [
  { re: /front\s+bedroom/i, canonical: "Front Bedroom", confidence: "high" },
  { re: /rear\s+bedroom/i, canonical: "Rear Bedroom", confidence: "high" },
  { re: /master\s+bedroom/i, canonical: "Master Bedroom", confidence: "high" },
  { re: /sitting\s+(area|room)/i, canonical: "Sitting Area", confidence: "high" },
  { re: /living\s+(area|room)/i, canonical: "Living Room", confidence: "high" },
  { re: /dining\s+(area|room)/i, canonical: "Dining Area", confidence: "high" },
  { re: /\blounge\b/i, canonical: "Lounge", confidence: "high" },
  { re: /\bkitchen\b/i, canonical: "Kitchen", confidence: "high" },
  { re: /\bbathroom\b/i, canonical: "Bathroom", confidence: "high" },
  { re: /\bshower\s+room\b/i, canonical: "Shower Room", confidence: "high" },
  { re: /\bensuite|en-suite\b/i, canonical: "Ensuite", confidence: "medium" },
  { re: /\bcloakroom\b/i, canonical: "Cloakroom", confidence: "medium" },
  { re: /\bw\.?c\.?\b/i, canonical: "WC", confidence: "low" },
  { re: /\bentrance\b/i, canonical: "Entrance", confidence: "medium" },
  { re: /\bhall(way)?\b/i, canonical: "Hall", confidence: "high" },
  { re: /\blanding\b/i, canonical: "Landing", confidence: "high" },
  { re: /\bbedroom\b/i, canonical: "Bedroom", confidence: "high" },
  { re: /\bstudy\b/i, canonical: "Study", confidence: "medium" },
  { re: /\butility\b/i, canonical: "Utility", confidence: "medium" },
];

/** Words that also appear on plans but are NOT rooms — used to strip context. */
const NOISE = /((front|rear)\s+garden|garden|road|street|manhole|brick\s+wall|copyright|drawing|elevation|section\s+[a-c])/gi;

/** Extract room names from the text of one floor-plan page. */
export function extractRoomNamesFromText(text: string): Array<{ name: string; confidence: Confidence }> {
  let t = text.replace(/\s+/g, " ").replace(NOISE, " ");
  const found: Array<{ name: string; confidence: Confidence }> = [];
  for (const entry of ROOM_VOCAB) {
    if (entry.re.test(t)) {
      found.push({ name: entry.canonical, confidence: entry.confidence });
      // Remove the matched word so "FRONT BEDROOM" doesn't also yield "Bedroom"
      t = t.replace(new RegExp(entry.re.source, "gi"), " ");
    }
  }
  return found;
}

const PAGE_FLOOR: Record<string, FloorLevel> = { ground: "ground", first: "first" };

/** Run extraction across all pages classified as floor plans. */
export function extractRooms(pages: PlanPage[]): ExtractedRoom[] {
  resetGenericLayout();
  const rooms: ExtractedRoom[] = [];
  for (const page of pages) {
    const floor = PAGE_FLOOR[page.kind];
    if (!floor) continue;
    const consumed = new Set<any>();
    for (const { name, confidence } of extractRoomNamesFromText(page.text)) {
      const curated = lookupLayout(name, floor, consumed);
      const placed = curated ?? genericLayout(name, floor);
      rooms.push({
        id: nextId(),
        name,
        floor,
        sourcePage: page.index,
        // Curated footprint = we recognised the room shape → keep label
        // confidence; generic packer fallback = geometry is a guess → "low".
        confidence: curated ? confidence : "low",
        geometry: placed.geometry,
        doors: placed.doors,
        windows: placed.windows,
        openPlan: false,
      });
    }
  }
  return rooms;
}

/** Fallback demo rooms for when a PDF has no readable text layer at all. */
export function demoRooms(): ExtractedRoom[] {
  resetGenericLayout();
  const mk = (name: string, floor: FloorLevel): ExtractedRoom => {
    const consumed = new Set<any>();
    const placed = lookupLayout(name, floor, consumed) ?? genericLayout(name, floor);
    return {
      id: nextId(),
      name,
      floor,
      sourcePage: -1,
      confidence: "low",
      geometry: placed.geometry,
      doors: placed.doors,
      windows: placed.windows,
      openPlan: false,
    };
  };
  return [
    mk("Sitting Area", "ground"),
    mk("Dining Area", "ground"),
    mk("Kitchen", "ground"),
    mk("Hall", "ground"),
    mk("Bathroom", "ground"),
    mk("Front Bedroom", "first"),
    mk("Rear Bedroom", "first"),
    mk("Bathroom", "first"),
    mk("Landing", "first"),
  ];
}

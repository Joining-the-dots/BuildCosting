import type { FloorLevel, RoomGeometry } from "../types";

/**
 * Curated footprint layouts.
 *
 * Real room-label extraction is done from the PDF text layer, but the PDF
 * carries no machine-readable geometry in this prototype, so positions/sizes
 * are synthesised here. The Thornton Road layout mirrors the example plan
 * (a ~5.1m-wide London terrace with a rear extension). Any room label we
 * don't recognise falls back to `genericLayout`, which packs rooms in rows.
 *
 * Later this module is replaced by real vector extraction — the rest of the
 * app only consumes `RoomGeometry`.
 */

interface LayoutEntry {
  match: RegExp;
  geometry: RoomGeometry;
  doors: number;
  windows: number;
}

const H_GROUND = 2.4;
const H_FIRST = 2.28; // sections on the sample plan show 2280mm

/** Ground floor of the 21 Thornton Road style terrace. z runs front → rear. */
const TERRACE_GROUND: LayoutEntry[] = [
  { match: /^entrance/i, geometry: { x: 3.9, z: 0, width: 1.2, depth: 2.0, height: H_GROUND }, doors: 2, windows: 0 },
  { match: /^hall/i, geometry: { x: 3.9, z: 2.0, width: 1.2, depth: 3.4, height: H_GROUND }, doors: 3, windows: 0 },
  { match: /sitting|living|lounge/i, geometry: { x: 0, z: 0, width: 3.9, depth: 4.2, height: H_GROUND }, doors: 1, windows: 2 },
  { match: /dining/i, geometry: { x: 0, z: 4.2, width: 3.9, depth: 3.4, height: H_GROUND }, doors: 1, windows: 1 },
  { match: /kitchen/i, geometry: { x: 0, z: 7.6, width: 2.9, depth: 5.2, height: H_GROUND }, doors: 1, windows: 2 },
  { match: /bath|shower|wc/i, geometry: { x: 2.9, z: 7.6, width: 2.2, depth: 2.2, height: H_GROUND }, doors: 1, windows: 1 },
  { match: /bedroom/i, geometry: { x: 2.9, z: 9.8, width: 2.2, depth: 3.0, height: H_GROUND }, doors: 1, windows: 1 },
];

/** First floor — typically stops short of the rear extension. */
const TERRACE_FIRST: LayoutEntry[] = [
  { match: /front bedroom/i, geometry: { x: 0, z: 0, width: 5.1, depth: 4.0, height: H_FIRST }, doors: 1, windows: 2 },
  { match: /rear bedroom/i, geometry: { x: 0, z: 4.0, width: 3.9, depth: 3.6, height: H_FIRST }, doors: 1, windows: 1 },
  { match: /landing/i, geometry: { x: 3.9, z: 4.0, width: 1.2, depth: 3.6, height: H_FIRST }, doors: 3, windows: 0 },
  { match: /bath|shower|wc/i, geometry: { x: 0, z: 7.6, width: 2.6, depth: 2.2, height: H_FIRST }, doors: 1, windows: 1 },
  { match: /bedroom/i, geometry: { x: 2.6, z: 7.6, width: 2.5, depth: 2.2, height: H_FIRST }, doors: 1, windows: 1 },
];

/** Default sizes by room type for plans we have no curated layout for. */
const GENERIC_SIZES: Array<{ match: RegExp; w: number; d: number }> = [
  { match: /kitchen/i, w: 3.4, d: 3.6 },
  { match: /sitting|living|lounge|reception/i, w: 4.2, d: 4.4 },
  { match: /dining/i, w: 3.6, d: 3.4 },
  { match: /bedroom/i, w: 3.6, d: 3.4 },
  { match: /bath|shower|ensuite|wc/i, w: 2.2, d: 2.2 },
  { match: /hall|landing|corridor/i, w: 1.2, d: 3.2 },
  { match: /entrance|porch|lobby/i, w: 1.4, d: 2.0 },
  { match: /study|office/i, w: 2.8, d: 2.8 },
  { match: /utility/i, w: 2.0, d: 2.4 },
];

const usedPerFloor = new Map<string, { cursorX: number; cursorZ: number; rowDepth: number }>();

/** Reset the generic packer between extraction runs. */
export function resetGenericLayout() {
  usedPerFloor.clear();
}

/** Simple row packer: places unknown rooms left→right in 8m-wide rows. */
export function genericLayout(name: string, floor: FloorLevel): { geometry: RoomGeometry; doors: number; windows: number } {
  const size = GENERIC_SIZES.find((s) => s.match.test(name)) ?? { w: 3.2, d: 3.2 };
  const state = usedPerFloor.get(floor) ?? { cursorX: 0, cursorZ: 0, rowDepth: 0 };
  if (state.cursorX + size.w > 8.5) {
    state.cursorX = 0;
    state.cursorZ += state.rowDepth + 0.0;
    state.rowDepth = 0;
  }
  const geometry: RoomGeometry = {
    x: state.cursorX,
    z: state.cursorZ,
    width: size.w,
    depth: size.d,
    height: floor === "ground" ? H_GROUND : H_FIRST,
  };
  state.cursorX += size.w;
  state.rowDepth = Math.max(state.rowDepth, size.d);
  usedPerFloor.set(floor, state);
  const isWet = /bath|shower|wc|ensuite/i.test(name);
  return { geometry, doors: 1, windows: isWet ? 1 : /hall|landing/i.test(name) ? 0 : 2 };
}

/**
 * Find a curated footprint for a room label. Entries are consumed once per
 * extraction run so e.g. two "Bathroom" labels land in different slots.
 */
export function lookupLayout(
  name: string,
  floor: FloorLevel,
  consumed: Set<LayoutEntry>,
): { geometry: RoomGeometry; doors: number; windows: number } | null {
  const table = floor === "ground" ? TERRACE_GROUND : TERRACE_FIRST;
  for (const entry of table) {
    if (consumed.has(entry)) continue;
    if (entry.match.test(name)) {
      consumed.add(entry);
      return { geometry: { ...entry.geometry }, doors: entry.doors, windows: entry.windows };
    }
  }
  return null;
}

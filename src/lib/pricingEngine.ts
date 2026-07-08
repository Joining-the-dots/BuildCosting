import type {
  BuilderRate,
  EstimateLineItem,
  OptionGroupDef,
  PricingOptionDef,
  Room,
  RoomDerived,
  SelectedOption,
  StructuralWork,
} from "../types";
import { OPTION_GROUPS } from "../data/pricing";
import { structuralSubtotal } from "./structural";

/** Derived quantities. Wall area nets off standard door/window openings. */
export function deriveRoom(room: Pick<Room, "geometry" | "doors" | "windows">): RoomDerived {
  const { width, depth, height } = room.geometry;
  const perimeter = 2 * (width + depth);
  const grossWall = perimeter * height;
  const openings = room.doors * (0.84 * 1.98) + room.windows * (1.2 * 1.2);
  return {
    floorArea: round1(width * depth),
    ceilingArea: round1(width * depth),
    perimeter: round1(perimeter),
    wallArea: round1(Math.max(grossWall - openings, grossWall * 0.55)),
  };
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export function getGroup(groupId: string): OptionGroupDef | undefined {
  return OPTION_GROUPS.find((g) => g.id === groupId);
}

export function getOption(groupId: string, optionId: string): PricingOptionDef | undefined {
  return getGroup(groupId)?.options.find((o) => o.id === optionId);
}

function rateOf(rates: BuilderRate[], id: string): BuilderRate {
  const r = rates.find((r) => r.id === id);
  if (!r) throw new Error(`Unknown rate ${id}`);
  return r;
}

/** Quantity for one option component in a given room. */
function componentQty(
  basis: string,
  derived: RoomDerived,
  sel: SelectedOption,
  opt: PricingOptionDef,
): number {
  switch (basis) {
    case "floorArea":
      return derived.floorArea;
    case "wallArea":
      return derived.wallArea;
    case "ceilingArea":
      return derived.ceilingArea;
    case "perimeter":
      return derived.perimeter;
    case "count":
      return sel.quantityOverride ?? opt.defaultCount?.(derived) ?? 1;
    default:
      return 1;
  }
}

/** Cost of a single selection (one option in one group) for a room. */
export function selectionCost(room: Room, sel: SelectedOption, rates: BuilderRate[]): number {
  const opt = getOption(sel.groupId, sel.optionId);
  if (!opt) return 0;
  const derived = deriveRoom(room);
  return opt.components.reduce((sum, c) => {
    const rate = rateOf(rates, c.rateId);
    return sum + componentQty(c.qty, derived, sel, opt) * rate.rate;
  }, 0);
}

/** Itemised line items for a room. */
export function roomLineItems(room: Room, rates: BuilderRate[]): EstimateLineItem[] {
  const derived = deriveRoom(room);
  const items: EstimateLineItem[] = [];
  for (const sel of room.selections) {
    const opt = getOption(sel.groupId, sel.optionId);
    if (!opt) continue;
    for (const c of opt.components) {
      const rate = rateOf(rates, c.rateId);
      const qty = componentQty(c.qty, derived, sel, opt);
      items.push({
        roomId: room.id,
        groupId: sel.groupId,
        optionId: sel.optionId,
        label: `${opt.label}${opt.components.length > 1 ? ` — ${rate.label}` : ""}`,
        qty: Math.round(qty * 10) / 10,
        unit: rate.unit,
        rate: rate.rate,
        total: Math.round(qty * rate.rate),
      });
    }
  }
  return items;
}

export function roomSubtotal(room: Room, rates: BuilderRate[]): number {
  return roomLineItems(room, rates).reduce((s, i) => s + i.total, 0);
}

export interface ProjectTotals {
  rooms: number;
  structural: number;
  works: number;
  margin: number;
  vat: number;
  total: number;
}

/** Whole-project totals: room works + structural works + margin + VAT. */
export function projectTotals(
  rooms: Room[],
  rates: BuilderRate[],
  structuralWorks: StructuralWork[] = [],
): ProjectTotals {
  const roomsSum = rooms.reduce((s, r) => s + roomSubtotal(r, rates), 0);
  const structural = structuralSubtotal(structuralWorks, rates);
  const works = roomsSum + structural;
  const marginPct = rates.find((r) => r.id === "margin_pct")?.rate ?? 0;
  const vatPct = rates.find((r) => r.id === "vat_pct")?.rate ?? 0;
  const margin = Math.round(works * (marginPct / 100));
  const vat = Math.round((works + margin) * (vatPct / 100));
  return { rooms: roomsSum, structural, works, margin, vat, total: works + margin + vat };
}

/**
 * Cost of a whole group for a room given an arbitrary selection set —
 * used to price variations against the approved baseline.
 */
export function groupCost(
  room: Room,
  groupId: string,
  selections: SelectedOption[],
  rates: BuilderRate[],
): number {
  return selections
    .filter((s) => s.groupId === groupId)
    .reduce((sum, s) => sum + selectionCost(room, s, rates), 0);
}

/** Aggregate confidence for a room's estimate (drives the badge in the UI). */
export function roomConfidenceNote(room: Room): string {
  switch (room.confidence) {
    case "high":
      return "Dimensions from plan layout — quantities reliable.";
    case "medium":
      return "Room recognised; dimensions estimated — verify on site.";
    default:
      return "Low confidence — dimensions are placeholders, confirm before relying on this price.";
  }
}

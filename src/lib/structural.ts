import type { BuilderRate, Edge, Room, StructuralWork } from "../types";
import { DOOR_HEIGHT_M, GARDEN_DOOR_SPECS } from "../data/pricing";

/**
 * Geometry helpers for "structural renovate mode".
 *
 * Rooms are axis-aligned rectangles, so wall adjacency is interval overlap:
 * two rooms share a wall when their facing edges are within WALL_TOL and the
 * perpendicular ranges overlap by at least MIN_SHARED metres.
 */

const WALL_TOL = 0.3; // how close two edges must be to count as one wall
const MIN_SHARED = 0.6; // minimum shared run to offer "remove wall"

export const OPPOSITE: Record<Edge, Edge> = { N: "S", S: "N", E: "W", W: "E" };

/** Length of a room's wall along the given edge. */
export function edgeLength(room: Room, edge: Edge): number {
  return edge === "N" || edge === "S" ? room.geometry.width : room.geometry.depth;
}

export interface Adjacency {
  room: Room;
  /** Overlap span in THIS room's edge coordinates: [start, length]. */
  start: number;
  length: number;
}

/** Find the room on the other side of `edge`, if any (same floor only). */
export function adjacentRoom(room: Room, edge: Edge, rooms: Room[]): Adjacency | null {
  const g = room.geometry;
  let best: Adjacency | null = null;
  for (const other of rooms) {
    if (other.id === room.id || other.floor !== room.floor) continue;
    const o = other.geometry;
    let touching = false;
    let lo = 0;
    let hi = 0;
    if (edge === "E" && Math.abs(o.x - (g.x + g.width)) < WALL_TOL) {
      touching = true;
      lo = Math.max(g.z, o.z);
      hi = Math.min(g.z + g.depth, o.z + o.depth);
    } else if (edge === "W" && Math.abs(g.x - (o.x + o.width)) < WALL_TOL) {
      touching = true;
      lo = Math.max(g.z, o.z);
      hi = Math.min(g.z + g.depth, o.z + o.depth);
    } else if (edge === "N" && Math.abs(o.z - (g.z + g.depth)) < WALL_TOL) {
      touching = true;
      lo = Math.max(g.x, o.x);
      hi = Math.min(g.x + g.width, o.x + o.width);
    } else if (edge === "S" && Math.abs(g.z - (o.z + o.depth)) < WALL_TOL) {
      touching = true;
      lo = Math.max(g.x, o.x);
      hi = Math.min(g.x + g.width, o.x + o.width);
    }
    if (!touching || hi - lo < MIN_SHARED) continue;
    const start = (edge === "E" || edge === "W" ? lo - g.z : lo - g.x);
    const adj: Adjacency = { room: other, start, length: hi - lo };
    if (!best || adj.length > best.length) best = adj;
  }
  return best;
}

export function isExterior(room: Room, edge: Edge, rooms: Room[]): boolean {
  return adjacentRoom(room, edge, rooms) === null;
}

/** Live cost of a structural work item under the current rates. */
export function structuralCost(work: StructuralWork, rates: BuilderRate[]): number {
  const rate = (id: string) => rates.find((r) => r.id === id)?.rate ?? 0;
  switch (work.type) {
    case "remove_wall":
      return Math.round(
        (work.lengthM ?? 0) * (work.heightM ?? 2.4) * rate(work.loadBearing ? "demo_load" : "demo_stud"),
      );
    case "add_wall":
      return Math.round((work.lengthM ?? 0) * (work.heightM ?? 2.4) * rate("build_stud"));
    case "demolish_room":
      return Math.round((work.areaM2 ?? 0) * rate("demo_room"));
    case "garden_doors": {
      const spec = GARDEN_DOOR_SPECS.find((s) => s.id === work.specId) ?? GARDEN_DOOR_SPECS[0];
      const w = work.lengthM ?? 0;
      return Math.round(w * DOOR_HEIGHT_M * rate(spec.rateId) + w * rate("lintel"));
    }
  }
}

export function structuralSubtotal(works: StructuralWork[], rates: BuilderRate[]): number {
  return works.reduce((s, w) => s + structuralCost(w, rates), 0);
}

// ---------- render view: what each room's walls look like after works ----------

export interface EdgeOpening {
  start: number;
  length: number;
}

export interface GardenDoorPlacement extends EdgeOpening {
  specId: string;
}

export interface RoomStructuralView {
  demolished: boolean;
  /** Wall spans removed per edge (from remove_wall works on either side). */
  openings: Partial<Record<Edge, EdgeOpening[]>>;
  /** Garden doors fitted per edge. */
  doors: Partial<Record<Edge, GardenDoorPlacement>>;
}

/** Compute how structural works affect one room's rendering. */
export function structuralView(room: Room, rooms: Room[], works: StructuralWork[]): RoomStructuralView {
  const view: RoomStructuralView = { demolished: false, openings: {}, doors: {} };
  for (const w of works) {
    if (w.type === "demolish_room" && w.roomId === room.id) view.demolished = true;

    if (w.type === "remove_wall") {
      // The opening shows on BOTH rooms' facing walls.
      let edge: Edge | null = null;
      let counterpartId: string | null = null;
      if (w.roomId === room.id && w.edge) {
        edge = w.edge;
        counterpartId = w.targetRoomId ?? null;
      } else if (w.targetRoomId === room.id && w.edge) {
        edge = OPPOSITE[w.edge];
        counterpartId = w.roomId;
      }
      if (edge) {
        const counterpart = rooms.find((r) => r.id === counterpartId);
        // Re-derive the overlap from current geometry; if the other room no
        // longer exists (merged away), open the recorded length centred.
        let span: EdgeOpening;
        if (counterpart) {
          const adj = adjacentRoom(room, edge, rooms);
          span =
            adj && adj.room.id === counterpart.id
              ? { start: adj.start, length: adj.length }
              : centredSpan(room, edge, w.lengthM ?? edgeLength(room, edge));
        } else {
          span = centredSpan(room, edge, w.lengthM ?? edgeLength(room, edge));
        }
        (view.openings[edge] ??= []).push(span);
      }
    }

    if (w.type === "garden_doors" && w.roomId === room.id && w.edge) {
      const span = centredSpan(room, w.edge, w.lengthM ?? 2.4);
      view.doors[w.edge] = { ...span, specId: w.specId ?? "crittall" };
      (view.openings[w.edge] ??= []).push(span);
    }
  }
  return view;
}

function centredSpan(room: Room, edge: Edge, length: number): EdgeOpening {
  const L = edgeLength(room, edge);
  const len = Math.min(length, L - 0.3);
  return { start: (L - len) / 2, length: len };
}

/** Subtract cut spans from [0, L] → remaining solid wall segments. */
export function solidSegments(L: number, cuts: EdgeOpening[]): EdgeOpening[] {
  const sorted = [...cuts].sort((a, b) => a.start - b.start);
  const out: EdgeOpening[] = [];
  let cursor = 0;
  for (const c of sorted) {
    const s = Math.max(0, c.start);
    const e = Math.min(L, c.start + c.length);
    if (s - cursor > 0.05) out.push({ start: cursor, length: s - cursor });
    cursor = Math.max(cursor, e);
  }
  if (L - cursor > 0.05) out.push({ start: cursor, length: L - cursor });
  return out;
}

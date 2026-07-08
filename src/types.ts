/**
 * Core data model for the renovation pricing prototype.
 *
 * Everything is designed so the mock/heuristic extraction layer can later be
 * swapped for real vector/OCR plan parsing without touching the UI:
 * the UI only ever consumes `UploadedPlan`, `ExtractedRoom` and `Room`.
 */

export type FloorLevel = "ground" | "first" | "second";

/** How a PDF page has been classified (auto-detected, user-correctable). */
export type PageKind =
  | "ground"
  | "first"
  | "roof"
  | "elevation"
  | "section"
  | "ignore";

export type Confidence = "low" | "medium" | "high";

export type ThemeId = "dollhouse" | "architectural" | "dark";

export type TaskStatus = "not_started" | "in_progress" | "complete" | "approved";

export type VariationStatus = "draft" | "sent" | "approved" | "rejected";

/** One page of the uploaded PDF. */
export interface PlanPage {
  index: number; // 0-based
  label: string; // e.g. "Proposed Ground Floor" (from title block text)
  kind: PageKind; // current classification (user may override)
  autoKind: PageKind; // what auto-detection said (kept for the UI badge)
  autoConfidence: Confidence;
  text: string; // full extracted text layer, used for room-label extraction
  thumbnail: string; // dataURL PNG
}

export interface UploadedPlan {
  fileName: string;
  numPages: number;
  /** Original file as a data-URL so it survives page reloads via localStorage. */
  dataUrl: string;
  pages: PlanPage[];
  scaleNote: string; // e.g. "1:50 @ A3" if found in the text
  uploadedAt: string;
}

/** Simple rectangular footprint in metres. x/z = plan position, y = up. */
export interface RoomGeometry {
  x: number;
  z: number;
  width: number; // along x
  depth: number; // along z
  height: number; // ceiling height
}

/** A room as produced by the extraction step, before user confirmation. */
export interface ExtractedRoom {
  id: string;
  name: string;
  floor: FloorLevel;
  sourcePage: number; // 0-based PDF page index it was found on (-1 = manual)
  confidence: Confidence;
  geometry: RoomGeometry;
  doors: number;
  windows: number;
  openPlan: boolean;
}

/** Quantity basis used to price an option component. */
export type QtyBasis =
  | "floorArea" // m²
  | "wallArea" // m² (net of door/window openings)
  | "ceilingArea" // m²
  | "perimeter" // m
  | "count" // items (user-editable quantity)
  | "fixed"; // lump sum

/** One priced component of an option, e.g. "walls @ paint rate". */
export interface OptionComponent {
  rateId: string;
  qty: QtyBasis;
}

export interface PricingOptionDef {
  id: string;
  label: string;
  components: OptionComponent[];
  /** Default quantity for count-based options, derived from the room. */
  defaultCount?: (g: RoomDerived) => number;
  assumption?: string;
}

/** A group of options, e.g. "Flooring" (single-choice) or "Electrics" (multi). */
export interface OptionGroupDef {
  id: string;
  label: string;
  multi: boolean; // multi = independent toggles with quantities
  options: PricingOptionDef[];
  exclusion?: string;
}

/** The user's choice inside a group for a specific room. */
export interface SelectedOption {
  groupId: string;
  optionId: string;
  /** For count-based options the user can override the quantity. */
  quantityOverride?: number;
}

export interface RoomTask {
  id: string;
  name: string;
  status: TaskStatus;
}

/**
 * A movable furniture placeholder inside a room. Position is the piece's
 * anchor point in room-local metres; moving furniture never affects price.
 */
export interface FurnitureItem {
  id: string;
  kind: string; // registry key: bed | sofa | island | bath | rug | …
  x: number;
  z: number;
}

/** A confirmed room in the live project. */
export interface Room extends ExtractedRoom {
  selections: SelectedOption[];
  tasks: RoomTask[];
  notes: string;
  furniture: FurnitureItem[];
}

/** Derived quantities for a room (computed, never stored). */
export interface RoomDerived {
  floorArea: number;
  wallArea: number;
  ceilingArea: number;
  perimeter: number;
}

/** An editable builder rate. */
export interface BuilderRate {
  id: string;
  label: string;
  unit: string; // "m²" | "m" | "item" | "day" | "%"
  rate: number;
  category: string;
}

export interface EstimateLineItem {
  roomId: string;
  groupId: string;
  optionId: string;
  label: string;
  qty: number;
  unit: string;
  rate: number;
  total: number;
}

export interface Variation {
  id: string;
  roomId: string;
  roomName: string;
  groupId: string;
  groupLabel: string;
  fromLabel: string;
  toLabel: string;
  delta: number; // cost impact vs the approved baseline
  timeNote: string; // placeholder time impact
  status: VariationStatus;
  createdAt: string;
}

export interface ChangeLogEntry {
  at: string;
  text: string;
}

/** Compass edge of a room's rectangular footprint (S = front, z=0 side). */
export type Edge = "N" | "S" | "E" | "W";

export type StructuralWorkType =
  | "remove_wall" // demolish a wall between two rooms (optionally load-bearing)
  | "add_wall" // new stud wall (from splitting a room)
  | "demolish_room" // full strip-out / demolition of a room
  | "garden_doors"; // form a structural opening + fit glazed doors

/**
 * A costed structural action from "structural renovate mode".
 * Quantities (length/area) are frozen at creation time; the COST is always
 * computed live from the builder rates so rate edits reprice these too.
 */
export interface StructuralWork {
  id: string;
  type: StructuralWorkType;
  label: string; // human description, e.g. "Remove wall: Kitchen ↔ Dining Area"
  roomId: string;
  targetRoomId?: string; // other side of a removed shared wall
  edge?: Edge;
  lengthM?: number; // wall length / door opening width
  heightM?: number;
  areaM2?: number; // demolition floor area
  loadBearing?: boolean; // remove_wall: needs steel + engineer
  specId?: string; // garden_doors: crittall | alu | upvc
  createdAt: string;
}

export type Screen =
  | "dashboard"
  | "upload"
  | "confirm"
  | "model"
  | "pm"
  | "rates"
  | "variations";

export type ReworkStatus = "pending" | "accepted" | "waived";

/**
 * A rework charge: raised automatically when a change would undo a job that
 * is already ticked complete — e.g. re-specifying flooring after the Flooring
 * task is done, or moving a plumbed-in fitting after first fix. The amount is
 * always computed live from the rate library (see lib/rework.ts).
 */
export interface ReworkCharge {
  id: string;
  roomId: string;
  roomName: string;
  taskName: string; // the completed job that would need undoing
  reason: string;
  source: "option-change" | "furniture-move";
  groupId?: string; // option-change: amount = baseline group cost × undo %
  points?: number; // furniture-move: amount = points × service re-route rate
  itemId?: string;
  itemKind?: string;
  prevX?: number; // original position, for the free "undo move" escape hatch
  prevZ?: number;
  status: ReworkStatus;
  createdAt: string;
}

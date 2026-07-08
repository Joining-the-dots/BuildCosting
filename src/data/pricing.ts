import type { BuilderRate, OptionGroupDef } from "../types";

/**
 * Builder pricing library — every number in the app traces back to one of
 * these rates, so editing them on the Rates screen reprices the whole project.
 */
export const DEFAULT_RATES: BuilderRate[] = [
  { id: "labour_day", label: "Labour day rate", unit: "day", rate: 280, category: "General" },
  { id: "margin_pct", label: "Builder margin", unit: "%", rate: 15, category: "General" },
  { id: "vat_pct", label: "VAT", unit: "%", rate: 20, category: "General" },

  { id: "floor_carpet", label: "Carpet supplied & fitted", unit: "m²", rate: 45, category: "Flooring" },
  { id: "floor_wood", label: "Engineered wood", unit: "m²", rate: 95, category: "Flooring" },
  { id: "floor_tiles", label: "Floor tiles", unit: "m²", rate: 110, category: "Flooring" },
  { id: "floor_micro", label: "Microcement", unit: "m²", rate: 140, category: "Flooring" },
  { id: "ufh", label: "Underfloor heating (wet)", unit: "m²", rate: 85, category: "Flooring" },

  { id: "plaster_patch", label: "Plaster patch repair", unit: "m²", rate: 8, category: "Plastering" },
  { id: "plaster_skim", label: "Plaster skim", unit: "m²", rate: 22, category: "Plastering" },
  { id: "plaster_reboard", label: "Reboard & skim", unit: "m²", rate: 38, category: "Plastering" },

  { id: "paint_walls", label: "Painting walls", unit: "m²", rate: 18, category: "Decoration" },
  { id: "paint_ceiling", label: "Ceiling painting", unit: "m²", rate: 15, category: "Decoration" },

  { id: "downlight", label: "Downlight", unit: "item", rate: 95, category: "Electrics" },
  { id: "socket", label: "Double socket", unit: "item", rate: 120, category: "Electrics" },
  { id: "switch", label: "Switch", unit: "item", rate: 85, category: "Electrics" },
  { id: "led_strip", label: "LED strip", unit: "m", rate: 40, category: "Electrics" },

  { id: "radiator", label: "Radiator supplied & fitted", unit: "item", rate: 450, category: "Plumbing" },
  { id: "sink", label: "Sink / basin plumbing", unit: "item", rate: 380, category: "Plumbing" },
  { id: "appliance", label: "Appliance connection", unit: "item", rate: 150, category: "Plumbing" },

  { id: "skirting", label: "Skirting", unit: "m", rate: 35, category: "Joinery" },
  { id: "cupboards", label: "Fitted cupboard run", unit: "item", rate: 1200, category: "Joinery" },
  { id: "bespoke", label: "Bespoke joinery piece", unit: "item", rate: 2500, category: "Joinery" },

  { id: "demo_stud", label: "Remove stud wall (incl. disposal)", unit: "m²", rate: 160, category: "Structural" },
  { id: "demo_load", label: "Remove load-bearing wall (incl. steel & engineer)", unit: "m²", rate: 520, category: "Structural" },
  { id: "demo_room", label: "Room demolition / strip-out", unit: "m²", rate: 95, category: "Structural" },
  { id: "build_stud", label: "Build stud wall (boarded & skimmed)", unit: "m²", rate: 210, category: "Structural" },
  { id: "lintel", label: "Structural opening (lintel/steel)", unit: "m", rate: 680, category: "Structural" },
  { id: "doors_steel", label: "Steel Crittall-style doors", unit: "m²", rate: 2100, category: "Structural" },
  { id: "doors_alu", label: "Aluminium sliding doors", unit: "m²", rate: 1350, category: "Structural" },
  { id: "doors_upvc", label: "uPVC French doors", unit: "m²", rate: 900, category: "Structural" },

  { id: "rework_undo_pct", label: "Undoing completed work (of original cost)", unit: "%", rate: 40, category: "Rework" },
  { id: "rework_service_move", label: "Re-route services to a moved fitting", unit: "item", rate: 350, category: "Rework" },
];

/** Glazed garden-door design types offered on exterior walls. */
export interface GardenDoorSpec {
  id: string;
  label: string;
  rateId: string;
  frameColor: string; // 3D frame colour
  glazingBars: boolean; // Crittall-style grid
  assumption: string;
}

export const GARDEN_DOOR_SPECS: GardenDoorSpec[] = [
  {
    id: "crittall",
    label: "Steel Crittall-style",
    rateId: "doors_steel",
    frameColor: "#1c1c1e",
    glazingBars: true,
    assumption: "W20-profile steel, double glazed, factory finish",
  },
  {
    id: "alu",
    label: "Aluminium sliding",
    rateId: "doors_alu",
    frameColor: "#82878c",
    glazingBars: false,
    assumption: "Slim-frame alu sliders, double glazed",
  },
  {
    id: "upvc",
    label: "uPVC French",
    rateId: "doors_upvc",
    frameColor: "#f2f2ee",
    glazingBars: false,
    assumption: "White uPVC French doors + side lights",
  },
];

export const DOOR_HEIGHT_M = 2.1;

/**
 * The room pricing menu. Single-choice groups model "pick a spec level";
 * multi groups model independent toggles, each with an editable quantity.
 */
export const OPTION_GROUPS: OptionGroupDef[] = [
  {
    id: "flooring",
    label: "Flooring",
    multi: false,
    exclusion: "Excludes latex levelling and subfloor repairs.",
    options: [
      { id: "carpet", label: "Carpet", components: [{ rateId: "floor_carpet", qty: "floorArea" }], assumption: "Mid-range carpet incl. underlay" },
      { id: "wood", label: "Engineered wood", components: [{ rateId: "floor_wood", qty: "floorArea" }], assumption: "14mm board, glued or floated" },
      { id: "tiles", label: "Tiles", components: [{ rateId: "floor_tiles", qty: "floorArea" }], assumption: "Porcelain up to 600×600" },
      { id: "micro", label: "Microcement", components: [{ rateId: "floor_micro", qty: "floorArea" }], assumption: "3-coat system, sealed" },
    ],
  },
  {
    id: "ufh",
    label: "Underfloor heating",
    multi: false,
    exclusion: "Excludes boiler / manifold upgrades.",
    options: [
      { id: "ufh_yes", label: "Underfloor heating", components: [{ rateId: "ufh", qty: "floorArea" }], assumption: "Wet system in screed zone" },
    ],
  },
  {
    id: "plastering",
    label: "Plastering",
    multi: false,
    exclusion: "Excludes structural crack repair.",
    options: [
      { id: "patch", label: "Patch repair", components: [{ rateId: "plaster_patch", qty: "wallArea" }], assumption: "Localised making-good only" },
      { id: "skim", label: "Full skim", components: [{ rateId: "plaster_skim", qty: "wallArea" }], assumption: "2-coat skim over existing" },
      { id: "reboard", label: "Reboard & skim", components: [{ rateId: "plaster_reboard", qty: "wallArea" }], assumption: "12.5mm board + skim" },
    ],
  },
  {
    id: "decoration",
    label: "Decoration",
    multi: false,
    exclusion: "Excludes wallpaper and specialist finishes.",
    options: [
      { id: "walls", label: "Walls only", components: [{ rateId: "paint_walls", qty: "wallArea" }], assumption: "Mist + 2 coats" },
      { id: "ceiling", label: "Ceiling only", components: [{ rateId: "paint_ceiling", qty: "ceilingArea" }], assumption: "2 coats" },
      {
        id: "full",
        label: "Full room",
        components: [
          { rateId: "paint_walls", qty: "wallArea" },
          { rateId: "paint_ceiling", qty: "ceilingArea" },
        ],
        assumption: "Walls + ceiling, woodwork excluded",
      },
    ],
  },
  {
    id: "electrics",
    label: "Electrics",
    multi: true,
    exclusion: "Excludes consumer unit upgrade and certification.",
    options: [
      { id: "sockets", label: "Double sockets", components: [{ rateId: "socket", qty: "count" }], defaultCount: (g) => Math.max(2, Math.round(g.floorArea / 4)) },
      { id: "switches", label: "Switches", components: [{ rateId: "switch", qty: "count" }], defaultCount: () => 1 },
      { id: "downlights", label: "Downlights", components: [{ rateId: "downlight", qty: "count" }], defaultCount: (g) => Math.max(4, Math.round(g.ceilingArea / 1.8)) },
      { id: "led", label: "LED strip (m)", components: [{ rateId: "led_strip", qty: "count" }], defaultCount: (g) => Math.round(g.perimeter * 0.25) },
    ],
  },
  {
    id: "plumbing",
    label: "Plumbing",
    multi: true,
    exclusion: "Excludes sanitaryware supply unless stated.",
    options: [
      { id: "radiator", label: "Radiators", components: [{ rateId: "radiator", qty: "count" }], defaultCount: () => 1 },
      { id: "sink", label: "Sink / basin", components: [{ rateId: "sink", qty: "count" }], defaultCount: () => 1 },
      { id: "appliance", label: "Appliance connections", components: [{ rateId: "appliance", qty: "count" }], defaultCount: () => 1 },
    ],
  },
  {
    id: "joinery",
    label: "Joinery",
    multi: true,
    exclusion: "Excludes doors and architraves unless stated.",
    options: [
      { id: "skirting", label: "Skirting", components: [{ rateId: "skirting", qty: "perimeter" }], assumption: "MDF 145mm primed" },
      { id: "cupboards", label: "Fitted cupboards", components: [{ rateId: "cupboards", qty: "count" }], defaultCount: () => 1 },
      { id: "bespoke", label: "Bespoke joinery", components: [{ rateId: "bespoke", qty: "count" }], defaultCount: () => 1 },
    ],
  },
];

/** Standard task list applied to every room for the progress workflow. */
export const TASK_TEMPLATE = [
  "Strip out",
  "First fix electrics",
  "First fix plumbing",
  "Plastering",
  "Flooring",
  "Decoration",
  "Final fix",
  "Snagging",
];

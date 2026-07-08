# ScopePrice — 3D Renovation Pricing (prototype)

A premium prototype that turns an uploaded PDF architect plan into an interactive
3D cutaway "dollhouse" model, then lets you price building works room-by-room
against an editable builder rate library, with live totals, task progress and
variation (change-order) tracking.

## What the app does

1. **Plan Upload** — drag-and-drop a PDF. Every page is rendered to a thumbnail
   (PDF.js), its text layer is read, and pages are auto-classified as
   *Ground floor / First floor / Roof / Elevation / Section / Ignore* from
   title-block phrases like "Proposed Ground Floor". You can override any page.
2. **Extract rooms** — room labels (KITCHEN, SITTING AREA, FRONT BEDROOM…) are
   read from the text of the pages marked as floor plans.
3. **Confirm Rooms** — PDF preview beside an editable room list: rename, resize,
   set ceiling height, doors/windows, re-assign floor, merge (open-plan), split,
   add, delete. Each room carries a low/medium/high confidence badge.
4. **3D Scope Model** — a cutaway dollhouse built from the room list: extruded
   rooms with cut walls, door gaps, window hints, procedural wood/tile/carpet
   floor materials that follow the chosen flooring spec, furniture placeholders
   by room type, floating labels, hover + selection highlights, floor toggle
   (Ground / First / Whole-house exploded stack), isometric ↔ top-down camera,
   and three themes (Premium Dollhouse · Clean Architectural · Dark Technical).
5. **Room focus mode** — click a room (3D or side list) to ghost every other
   room, fly the camera to it, and open the pricing panel: flooring, UFH,
   plastering, decoration, electrics, plumbing, joinery, with quantities ×
   builder unit rates, itemised breakdown, assumptions and exclusions.
5b. **Structural renovate mode** — toggle "Structural" above the model to edit
   one floor at a time. Click any **wall**: shared walls offer *Remove wall*
   or *Remove & merge rooms* (load-bearing checkbox switches to the steel+
   engineer rate); exterior walls offer *garden doors* in three design types
   (Steel Crittall-style with glazing bars, aluminium sliding, uPVC French)
   with a structural-opening/lintel allowance. Click any **floor**: demolish/
   strip out the room (e.g. rip out the whole kitchen) or split it with a new
   costed stud wall. Every action lands in a Structural Works list (deletable),
   renders in the 3D model (openings, glazed doors, demolition hatching) and
   feeds the running project total. Quantities freeze at creation; prices stay
   live against the rate library. Fitted garden doors can be **resized** with a
   width slider (re-click the wall) — the 3D doors and the price update live.
   "Add a new wall" places a green ghost wall you position with a slider
   (front–back or side–side) before building it, which splits the room there.
5c. **Drag & drop furniture** — in pricing mode every furniture piece (bed,
   sofa, island, bath, rugs, plants…) can be dragged across the room's floor;
   positions persist on the room record and moving furniture never affects
   the price. Camera orbit pauses while dragging; a plain click still selects
   the room.
6. **Pricing Library** — edit every unit rate (plus margin % and VAT %); the
   whole project reprices live.
7. **Progress** — 8 standard tasks per room (strip out → snagging), click to
   cycle status; progress bars per room and whole-project.
8. **Variations** — changing any option after the model is generated diffs the
   room against the approved baseline and raises a draft variation card
   (draft → sent → approved/rejected). Approving folds it into the baseline;
   rejecting reverts the room.

Everything persists to `localStorage` (including the PDF, as a data-URL).

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
```

### Single-file build (no server needed)

```bash
npm run build:single   # → dist-single/index.html
```

Produces ONE self-contained HTML file (~4 MB — JS, CSS, the pdf.js engine and
the sample plan are all inlined) that runs by double-clicking it. pdf.js runs
on the main thread in this app (no Web Worker), which is what makes the
single-file packaging possible.

No backend, no auth, no env vars. There's a **"try the sample plan"** button on
the upload screen wired to `public/sample-plan.pdf` (21 Thornton Road).

## What is real vs mocked

| Piece | Status |
|---|---|
| PDF rendering, thumbnails, page preview | **Real** (PDF.js) |
| Page classification (ground/first/roof/elevation/section) | **Real** — regex over the extracted text layer |
| Room label extraction | **Real** — vocabulary match over floor-plan page text |
| Room geometry (positions, sizes, doors, windows) | **Mocked** — curated terrace layout keyed by room name (`src/data/layouts.ts`), generic row-packer fallback for unknown names; flagged low-confidence so the user corrects it in Confirm Rooms |
| Scale detection ("1:50 @ A3") | Real text match, display-only |
| Pricing, variations, tasks, rates | Real logic, seeded defaults |

If a PDF has no text layer (scanned plans), extraction falls back to a template
room list the user can edit — the flow never dead-ends.

## Key files

```
src/
  types.ts               all TypeScript interfaces (Project → Variation)
  store.ts               zustand store: plan, rooms, rates, variations, 3D view state
  data/pricing.ts        builder rate library + room option catalogue
  data/layouts.ts        curated/mock room footprints  ← swap for real extraction
  lib/pdf.ts             PDF.js loading, thumbnails, text, page classification
  lib/extraction.ts      room-label vocabulary matching
  lib/pricingEngine.ts   quantities (areas/perimeter), line items, totals, group costs
  screens/               Dashboard · Upload · ConfirmRooms · Model · Rates · Variations
  components/            RoomPricingPanel (focus-mode editor) + shared UI atoms
  three/                 Scene, Room3D, Furniture, procedural textures, themes
```

## What to build next

1. **Real geometry extraction** — parse PDF vector line work (walls) to derive
   room polygons and true dimensions from the drawing scale; `layouts.ts` is the
   single seam to replace.
2. OCR fallback (scanned plans) via tesseract.js or a cloud vision API.
3. Non-rectangular room footprints (polygon extrusion is already the natural
   extension of `RoomGeometry`).
4. Door/window placement from the plan rather than counts.
5. Export: client-facing PDF quote and variation sign-off flow.
6. Multi-project support + backend persistence.

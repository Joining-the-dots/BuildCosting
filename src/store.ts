import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  BuilderRate,
  ChangeLogEntry,
  Edge,
  ExtractedRoom,
  FloorLevel,
  PageKind,
  ReworkCharge,
  ReworkStatus,
  Room,
  Screen,
  SelectedOption,
  StructuralWork,
  TaskStatus,
  ThemeId,
  UploadedPlan,
  Variation,
  VariationStatus,
} from "./types";
import { DEFAULT_RATES, OPTION_GROUPS, TASK_TEMPLATE } from "./data/pricing";
import { defaultFurniture } from "./data/furnitureLayout";
import { getGroup, getOption, groupCost } from "./lib/pricingEngine";
import { GROUP_TASK, SERVICE_ITEMS, taskDone } from "./lib/rework";
import { nextId } from "./lib/extraction";

export type FloorFilter = FloorLevel | "all";
export type CameraMode = "iso" | "top";
export type ModelMode = "pricing" | "structural";

/** What the user clicked in structural mode: a wall edge or a whole room. */
export interface StructTarget {
  roomId: string;
  edge?: Edge; // absent = the room itself (floor click)
}

/** Live preview of a new wall being placed ("add wall" in structural mode). */
export interface WallDraft {
  roomId: string;
  dir: "x" | "z"; // 'x' = wall at x=pos running front–back; 'z' = at z=pos running side–side
  pos: number;
}

interface ProjectState {
  // navigation
  screen: Screen;
  setScreen: (s: Screen) => void;

  projectName: string;
  setProjectName: (n: string) => void;

  // plan upload
  plan: UploadedPlan | null;
  setPlan: (p: UploadedPlan | null) => void;
  setPageKind: (pageIndex: number, kind: PageKind) => void;

  // extraction draft (Confirm Rooms screen)
  draftRooms: ExtractedRoom[];
  setDraftRooms: (rooms: ExtractedRoom[]) => void;
  updateDraftRoom: (id: string, patch: Partial<ExtractedRoom>) => void;
  addDraftRoom: (floor: FloorLevel) => void;
  deleteDraftRoom: (id: string) => void;
  mergeDraftRooms: (ids: string[]) => void;
  splitDraftRoom: (id: string) => void;

  // live project
  rooms: Room[];
  confirmRooms: () => void; // draft → live rooms + baseline snapshot
  updateRoom: (id: string, patch: Partial<Room>) => void;
  selectedRoomId: string | null;
  hoveredRoomId: string | null;
  selectRoom: (id: string | null) => void;
  hoverRoom: (id: string | null) => void;

  // pricing
  rates: BuilderRate[];
  setRate: (id: string, rate: number) => void;
  resetRates: () => void;
  /** Single-choice groups: pass optionId or null to clear. Multi: toggle. */
  setSelection: (roomId: string, groupId: string, optionId: string | null, quantityOverride?: number) => void;

  // variations
  baseline: Record<string, SelectedOption[]> | null; // roomId → snapshot
  variations: Variation[];
  setVariationStatus: (id: string, status: VariationStatus) => void;

  // tasks
  setTaskStatus: (roomId: string, taskId: string, status: TaskStatus) => void;

  // rework charges (raised when a change undoes a completed job)
  reworkCharges: ReworkCharge[];
  setReworkStatus: (id: string, status: ReworkStatus) => void;
  /** Free escape hatch: put a moved fitting back and drop its charge. */
  revertFurnitureMove: (chargeId: string) => void;

  // 3D view
  theme: ThemeId;
  setTheme: (t: ThemeId) => void;
  floorFilter: FloorFilter;
  setFloorFilter: (f: FloorFilter) => void;
  cameraMode: CameraMode;
  setCameraMode: (m: CameraMode) => void;

  // structural renovate mode
  modelMode: ModelMode;
  setModelMode: (m: ModelMode) => void;
  structTarget: StructTarget | null;
  setStructTarget: (t: StructTarget | null) => void;
  structuralWorks: StructuralWork[];
  addStructuralWork: (w: Omit<StructuralWork, "id" | "createdAt">) => void;
  deleteStructuralWork: (id: string) => void;
  /** Merge two live rooms into one open-plan space (after a wall removal). */
  mergeLiveRooms: (roomAId: string, roomBId: string) => void;
  /** Split a live room with a new wall at dir/pos (from the wall draft). */
  splitLiveRoom: (roomId: string, dir: "x" | "z", pos: number) => void;
  /** Preview wall while the user positions an "add wall" action. */
  wallDraft: WallDraft | null;
  setWallDraft: (w: WallDraft | null) => void;

  // furniture (drag & drop — free, no cost impact)
  draggingFurniture: boolean;
  setDraggingFurniture: (b: boolean) => void;
  moveFurnitureItem: (roomId: string, itemId: string, x: number, z: number) => void;

  // activity feed
  changes: ChangeLogEntry[];
  logChange: (text: string) => void;

  resetProject: () => void;
}

const now = () => new Date().toISOString();

function newTasks() {
  return TASK_TEMPLATE.map((name, i) => ({ id: `t${i}`, name, status: "not_started" as TaskStatus }));
}

/** Default spec applied to a freshly confirmed room so the model prices immediately. */
function defaultSelections(room: ExtractedRoom): SelectedOption[] {
  const wet = /bath|shower|wc|ensuite|cloak/i.test(room.name);
  const kitchen = /kitchen/i.test(room.name);
  const sels: SelectedOption[] = [
    { groupId: "flooring", optionId: wet || kitchen ? "tiles" : "wood" },
    { groupId: "decoration", optionId: "full" },
    { groupId: "plastering", optionId: "skim" },
    { groupId: "electrics", optionId: "sockets" },
    { groupId: "electrics", optionId: "downlights" },
    { groupId: "joinery", optionId: "skirting" },
  ];
  if (wet) sels.push({ groupId: "plumbing", optionId: "sink" });
  return sels;
}

/**
 * Recompute the variation list for one room+group after a change, by pricing
 * the group under the current selections vs the approved baseline snapshot.
 */
function upsertVariation(state: ProjectState, roomId: string, groupId: string): Variation[] {
  const room = state.rooms.find((r) => r.id === roomId);
  if (!room || !state.baseline) return state.variations;
  const baseSels = state.baseline[roomId] ?? [];
  const before = groupCost(room, groupId, baseSels, state.rates);
  const after = groupCost(room, groupId, room.selections, state.rates);
  const delta = Math.round(after - before);
  const group = getGroup(groupId);
  const label = (sels: SelectedOption[]) => {
    const inGroup = sels.filter((s) => s.groupId === groupId);
    if (!inGroup.length) return "None";
    return inGroup
      .map((s) => {
        const o = getOption(groupId, s.optionId);
        return s.quantityOverride != null ? `${o?.label} ×${s.quantityOverride}` : o?.label ?? s.optionId;
      })
      .join(", ");
  };

  // Keep resolved (approved/rejected) history; manage a single live draft per room+group.
  const others = state.variations.filter(
    (v) => !(v.roomId === roomId && v.groupId === groupId && (v.status === "draft" || v.status === "sent")),
  );
  if (delta === 0 && label(baseSels) === label(room.selections)) return others;
  return [
    ...others,
    {
      id: nextId("var"),
      roomId,
      roomName: room.name,
      groupId,
      groupLabel: group?.label ?? groupId,
      fromLabel: label(baseSels),
      toLabel: label(room.selections),
      delta,
      timeNote: Math.abs(delta) > 2000 ? "+2–3 days" : Math.abs(delta) > 500 ? "+1 day" : "No time impact",
      status: "draft",
      createdAt: now(),
    },
  ];
}

export const useStore = create<ProjectState>()(
  persist(
    (set, get) => ({
      screen: "upload",
      setScreen: (screen) => set({ screen }),

      projectName: "21 Thornton Road",
      setProjectName: (projectName) => set({ projectName }),

      plan: null,
      setPlan: (plan) =>
        set({
          plan,
          ...(plan ? {} : { draftRooms: [] }),
        }),
      setPageKind: (pageIndex, kind) =>
        set((s) => ({
          plan: s.plan && {
            ...s.plan,
            pages: s.plan.pages.map((p) => (p.index === pageIndex ? { ...p, kind } : p)),
          },
        })),

      draftRooms: [],
      setDraftRooms: (draftRooms) => set({ draftRooms }),
      updateDraftRoom: (id, patch) =>
        set((s) => ({
          draftRooms: s.draftRooms.map((r) =>
            r.id === id ? { ...r, ...patch, geometry: { ...r.geometry, ...(patch.geometry ?? {}) } } : r,
          ),
        })),
      addDraftRoom: (floor) =>
        set((s) => {
          const maxZ = Math.max(0, ...s.draftRooms.filter((r) => r.floor === floor).map((r) => r.geometry.z + r.geometry.depth));
          return {
            draftRooms: [
              ...s.draftRooms,
              {
                id: nextId(),
                name: "New Room",
                floor,
                sourcePage: -1,
                confidence: "low",
                geometry: { x: 0, z: maxZ + 0.5, width: 3, depth: 3, height: floor === "ground" ? 2.4 : 2.28 },
                doors: 1,
                windows: 1,
                openPlan: false,
              },
            ],
          };
        }),
      deleteDraftRoom: (id) => set((s) => ({ draftRooms: s.draftRooms.filter((r) => r.id !== id) })),
      mergeDraftRooms: (ids) =>
        set((s) => {
          const targets = s.draftRooms.filter((r) => ids.includes(r.id));
          if (targets.length < 2) return {};
          // Merged footprint = bounding box of the merged rooms (open-plan).
          const minX = Math.min(...targets.map((r) => r.geometry.x));
          const minZ = Math.min(...targets.map((r) => r.geometry.z));
          const maxX = Math.max(...targets.map((r) => r.geometry.x + r.geometry.width));
          const maxZ = Math.max(...targets.map((r) => r.geometry.z + r.geometry.depth));
          const merged: ExtractedRoom = {
            ...targets[0],
            id: nextId(),
            name: targets.map((r) => r.name).join(" + "),
            geometry: {
              x: minX,
              z: minZ,
              width: Math.round((maxX - minX) * 10) / 10,
              depth: Math.round((maxZ - minZ) * 10) / 10,
              height: targets[0].geometry.height,
            },
            doors: targets.reduce((n, r) => n + r.doors, 0),
            windows: targets.reduce((n, r) => n + r.windows, 0),
            openPlan: true,
            confidence: "medium",
          };
          return { draftRooms: [...s.draftRooms.filter((r) => !ids.includes(r.id)), merged] };
        }),
      splitDraftRoom: (id) =>
        set((s) => {
          const room = s.draftRooms.find((r) => r.id === id);
          if (!room) return {};
          const half = Math.round((room.geometry.width / 2) * 10) / 10;
          const a: ExtractedRoom = { ...room, geometry: { ...room.geometry, width: half }, name: `${room.name} A`, confidence: "low" };
          const b: ExtractedRoom = {
            ...room,
            id: nextId(),
            name: `${room.name} B`,
            geometry: { ...room.geometry, x: room.geometry.x + half, width: room.geometry.width - half },
            confidence: "low",
          };
          return { draftRooms: s.draftRooms.flatMap((r) => (r.id === id ? [a, b] : [r])) };
        }),

      rooms: [],
      confirmRooms: () => {
        const { draftRooms, logChange } = get();
        const rooms: Room[] = draftRooms.map((r) => ({
          ...r,
          selections: defaultSelections(r),
          tasks: newTasks(),
          notes: "",
          furniture: defaultFurniture(r),
        }));
        const baseline: Record<string, SelectedOption[]> = {};
        for (const r of rooms) baseline[r.id] = JSON.parse(JSON.stringify(r.selections));
        set({ rooms, baseline, variations: [], structuralWorks: [], reworkCharges: [], screen: "model", selectedRoomId: null, modelMode: "pricing" });
        logChange(`Confirmed ${rooms.length} rooms and generated the 3D model`);
      },
      updateRoom: (id, patch) =>
        set((s) => ({
          rooms: s.rooms.map((r) =>
            r.id === id ? { ...r, ...patch, geometry: { ...r.geometry, ...(patch.geometry ?? {}) } } : r,
          ),
        })),

      selectedRoomId: null,
      hoveredRoomId: null,
      selectRoom: (selectedRoomId) => set({ selectedRoomId }),
      hoverRoom: (hoveredRoomId) => set({ hoveredRoomId }),

      rates: DEFAULT_RATES,
      setRate: (id, rate) =>
        set((s) => {
          const old = s.rates.find((r) => r.id === id);
          if (old && old.rate !== rate) get().logChange(`Rate updated: ${old.label} £${old.rate} → £${rate}`);
          return { rates: s.rates.map((r) => (r.id === id ? { ...r, rate } : r)) };
        }),
      resetRates: () => set({ rates: DEFAULT_RATES }),

      setSelection: (roomId, groupId, optionId, quantityOverride) => {
        set((s) => {
          const rooms = s.rooms.map((room) => {
            if (room.id !== roomId) return room;
            const group = getGroup(groupId);
            let selections = room.selections.filter((x) => x.groupId !== groupId);
            const existing = room.selections.filter((x) => x.groupId === groupId);
            if (!group?.multi) {
              // single-choice: replace (or clear when optionId is null / re-clicked)
              if (optionId && !(existing.length === 1 && existing[0].optionId === optionId && quantityOverride === undefined)) {
                selections.push({ groupId, optionId, quantityOverride });
              }
            } else {
              // multi: keep the others, toggle / re-quantify this one
              selections = [...selections, ...existing.filter((x) => x.optionId !== optionId)];
              const already = existing.find((x) => x.optionId === optionId);
              if (optionId && (!already || quantityOverride !== undefined)) {
                selections.push({ groupId, optionId, quantityOverride: quantityOverride ?? already?.quantityOverride });
              }
            }
            return { ...room, selections };
          });
          return { rooms };
        });
        // after mutation, recompute the live variation card for this group
        set((s) => ({ variations: upsertVariation(s as ProjectState, roomId, groupId) }));

        // If the job that installs this group is already ticked complete,
        // a spec change means undoing finished work → manage a rework charge.
        set((s) => {
          const room = s.rooms.find((r) => r.id === roomId);
          const taskName = GROUP_TASK[groupId];
          if (!room || !taskName) return {};
          const pending = s.reworkCharges.find(
            (c) => c.source === "option-change" && c.roomId === roomId && c.groupId === groupId && c.status === "pending",
          );
          const specChanged = s.variations.some(
            (v) => v.roomId === roomId && v.groupId === groupId && (v.status === "draft" || v.status === "sent"),
          );
          const installedCost = groupCost(room, groupId, s.baseline?.[roomId] ?? [], s.rates);
          if (taskDone(room, taskName) && specChanged && installedCost > 0) {
            const charge: ReworkCharge = {
              id: pending?.id ?? nextId("rw"),
              roomId,
              roomName: room.name,
              taskName,
              reason: `${getGroup(groupId)?.label} re-specified after "${taskName}" was completed`,
              source: "option-change",
              groupId,
              status: "pending",
              createdAt: pending?.createdAt ?? now(),
            };
            if (!pending) get().logChange(`Rework raised: ${charge.reason}`);
            return { reworkCharges: [...s.reworkCharges.filter((c) => c.id !== charge.id), charge] };
          }
          // spec back to baseline (or job not done) — drop any pending charge
          return pending ? { reworkCharges: s.reworkCharges.filter((c) => c.id !== pending.id) } : {};
        });

        const room = get().rooms.find((r) => r.id === roomId);
        const opt = optionId ? getOption(groupId, optionId) : null;
        if (room) get().logChange(`${room.name}: ${getGroup(groupId)?.label} → ${opt?.label ?? "changed"}`);
      },

      baseline: null,
      variations: [],
      setVariationStatus: (id, status) =>
        set((s) => {
          const v = s.variations.find((x) => x.id === id);
          if (!v) return {};
          let rooms = s.rooms;
          let baseline = s.baseline;
          if (status === "approved" && baseline) {
            // approved → the new spec becomes the baseline for that group
            const room = s.rooms.find((r) => r.id === v.roomId);
            if (room) {
              baseline = {
                ...baseline,
                [v.roomId]: [
                  ...(baseline[v.roomId] ?? []).filter((b) => b.groupId !== v.groupId),
                  ...room.selections.filter((x) => x.groupId === v.groupId),
                ],
              };
            }
          }
          if (status === "rejected" && baseline) {
            // rejected → revert the room's group back to the baseline spec
            rooms = s.rooms.map((room) =>
              room.id === v.roomId
                ? {
                    ...room,
                    selections: [
                      ...room.selections.filter((x) => x.groupId !== v.groupId),
                      ...(baseline![v.roomId] ?? []).filter((b) => b.groupId === v.groupId),
                    ],
                  }
                : room,
            );
          }
          get().logChange(`Variation ${status}: ${v.roomName} — ${v.groupLabel}`);
          return {
            rooms,
            baseline,
            variations: s.variations.map((x) => (x.id === id ? { ...x, status } : x)),
          };
        }),

      setTaskStatus: (roomId, taskId, status) =>
        set((s) => ({
          rooms: s.rooms.map((r) =>
            r.id === roomId
              ? { ...r, tasks: r.tasks.map((t) => (t.id === taskId ? { ...t, status } : t)) }
              : r,
          ),
        })),

      theme: "dollhouse",
      setTheme: (theme) => set({ theme }),
      floorFilter: "all",
      setFloorFilter: (floorFilter) => set({ floorFilter }),
      cameraMode: "iso",
      setCameraMode: (cameraMode) => set({ cameraMode }),

      modelMode: "pricing",
      setModelMode: (modelMode) =>
        set((s) => ({
          modelMode,
          structTarget: null,
          selectedRoomId: null,
          // structural mode edits one floor at a time
          floorFilter: modelMode === "structural" && s.floorFilter === "all" ? "ground" : s.floorFilter,
        })),
      structTarget: null,
      setStructTarget: (structTarget) => set({ structTarget, wallDraft: null }),

      wallDraft: null,
      setWallDraft: (wallDraft) => set({ wallDraft }),

      draggingFurniture: false,
      setDraggingFurniture: (draggingFurniture) => set({ draggingFurniture }),
      moveFurnitureItem: (roomId, itemId, x, z) =>
        set((s) => {
          const room = s.rooms.find((r) => r.id === roomId);
          const item = room?.furniture.find((f) => f.id === itemId);
          if (!room || !item) return {};
          const prev = { x: item.x, z: item.z };
          const rooms = s.rooms.map((r) =>
            r.id === roomId
              ? { ...r, furniture: r.furniture.map((f) => (f.id === itemId ? { ...f, x, z } : f)) }
              : r,
          );

          // Moving furniture is free — UNLESS it's a serviced fitting and the
          // job that plumbed/wired it in is already ticked complete. Then the
          // move re-opens finished work and raises a clearly-priced charge.
          const svc = SERVICE_ITEMS[item.kind];
          let reworkCharges = s.reworkCharges;
          if (svc && taskDone(room, svc.taskName)) {
            const existing = s.reworkCharges.find(
              (c) => c.source === "furniture-move" && c.itemId === itemId && c.status === "pending",
            );
            // measure from where the fitting sat when the job was completed
            const origin = existing ? { x: existing.prevX!, z: existing.prevZ! } : prev;
            const dist = Math.hypot(x - origin.x, z - origin.z);
            if (dist < 0.4) {
              // dragged back (near) home — no rework needed after all
              if (existing) {
                reworkCharges = s.reworkCharges.filter((c) => c.id !== existing.id);
                get().logChange(`${svc.label} back in position — rework charge dropped (${room.name})`);
              }
            } else {
              const charge: ReworkCharge = {
                id: existing?.id ?? nextId("rw"),
                roomId,
                roomName: room.name,
                taskName: svc.taskName,
                reason: `${svc.label} moved ${dist.toFixed(1)} m after "${svc.taskName}" was completed`,
                source: "furniture-move",
                points: svc.points,
                itemId,
                itemKind: item.kind,
                prevX: origin.x,
                prevZ: origin.z,
                status: "pending",
                createdAt: existing?.createdAt ?? now(),
              };
              reworkCharges = [...s.reworkCharges.filter((c) => c.id !== charge.id), charge];
              if (!existing) get().logChange(`Rework raised: ${charge.reason}`);
            }
          }
          return { rooms, reworkCharges };
        }),

      reworkCharges: [],
      setReworkStatus: (id, status) =>
        set((s) => {
          const c = s.reworkCharges.find((x) => x.id === id);
          if (c) get().logChange(`Rework ${status}: ${c.reason}`);
          return { reworkCharges: s.reworkCharges.map((x) => (x.id === id ? { ...x, status } : x)) };
        }),
      revertFurnitureMove: (chargeId) =>
        set((s) => {
          const c = s.reworkCharges.find((x) => x.id === chargeId);
          if (!c || c.source !== "furniture-move" || c.prevX == null) return {};
          get().logChange(`${c.roomName}: fitting moved back — no rework charge`);
          return {
            rooms: s.rooms.map((r) =>
              r.id === c.roomId
                ? {
                    ...r,
                    furniture: r.furniture.map((f) => (f.id === c.itemId ? { ...f, x: c.prevX!, z: c.prevZ! } : f)),
                  }
                : r,
            ),
            reworkCharges: s.reworkCharges.filter((x) => x.id !== chargeId),
          };
        }),

      structuralWorks: [],
      addStructuralWork: (w) => {
        const work: StructuralWork = { ...w, id: nextId("sw"), createdAt: now() };
        set((s) => ({
          // one work item per (type, room, edge) — re-adding replaces
          structuralWorks: [
            ...s.structuralWorks.filter(
              (x) => !(x.type === work.type && x.roomId === work.roomId && x.edge === work.edge),
            ),
            work,
          ],
          // keep the card open for garden doors so they can be resized/re-specced
          structTarget: work.type === "garden_doors" ? s.structTarget : null,
        }));
        get().logChange(`Structural: ${work.label}`);
      },
      deleteStructuralWork: (id) =>
        set((s) => {
          const w = s.structuralWorks.find((x) => x.id === id);
          if (w) get().logChange(`Structural removed: ${w.label}`);
          return { structuralWorks: s.structuralWorks.filter((x) => x.id !== id) };
        }),

      mergeLiveRooms: (roomAId, roomBId) =>
        set((s) => {
          const a = s.rooms.find((r) => r.id === roomAId);
          const b = s.rooms.find((r) => r.id === roomBId);
          if (!a || !b) return {};
          const minX = Math.min(a.geometry.x, b.geometry.x);
          const minZ = Math.min(a.geometry.z, b.geometry.z);
          const maxX = Math.max(a.geometry.x + a.geometry.width, b.geometry.x + b.geometry.width);
          const maxZ = Math.max(a.geometry.z + a.geometry.depth, b.geometry.z + b.geometry.depth);
          const merged: Room = {
            ...a,
            id: nextId(),
            name: `${a.name} + ${b.name}`,
            geometry: {
              x: minX,
              z: minZ,
              width: Math.round((maxX - minX) * 10) / 10,
              depth: Math.round((maxZ - minZ) * 10) / 10,
              height: a.geometry.height,
            },
            doors: a.doors + b.doors,
            windows: a.windows + b.windows,
            openPlan: true,
            selections: a.selections,
            notes: [a.notes, b.notes].filter(Boolean).join("\n"),
            // keep both rooms' furniture, rebased into the merged footprint
            furniture: [
              ...(a.furniture ?? []).map((f) => ({ ...f, x: f.x + a.geometry.x - minX, z: f.z + a.geometry.z - minZ })),
              ...(b.furniture ?? []).map((f) => ({ ...f, x: f.x + b.geometry.x - minX, z: f.z + b.geometry.z - minZ })),
            ],
          };
          // Re-snapshot the merged room's baseline so no phantom variations,
          // and retarget any structural works that referenced the old rooms.
          const baseline = s.baseline
            ? {
                ...Object.fromEntries(Object.entries(s.baseline).filter(([k]) => k !== roomAId && k !== roomBId)),
                [merged.id]: JSON.parse(JSON.stringify(merged.selections)),
              }
            : s.baseline;
          get().logChange(`Merged ${a.name} + ${b.name} into one open-plan room`);
          return {
            rooms: [...s.rooms.filter((r) => r.id !== roomAId && r.id !== roomBId), merged],
            baseline,
            structuralWorks: s.structuralWorks.map((w) => {
              const r: StructuralWork = {
                ...w,
                roomId: w.roomId === roomAId || w.roomId === roomBId ? merged.id : w.roomId,
                targetRoomId:
                  w.targetRoomId === roomAId || w.targetRoomId === roomBId ? merged.id : w.targetRoomId,
              };
              // A wall removed BETWEEN the merged rooms no longer exists as
              // geometry — drop its edge so it stays a cost item only, and
              // doesn't cut an opening in the merged room's outer wall.
              if (r.type === "remove_wall" && r.roomId === r.targetRoomId) r.edge = undefined;
              return r;
            }),
            selectedRoomId: null,
            structTarget: null,
            variations: s.variations.filter((v) => v.roomId !== roomAId && v.roomId !== roomBId),
          };
        }),

      splitLiveRoom: (roomId, dir, pos) =>
        set((s) => {
          const room = s.rooms.find((r) => r.id === roomId);
          if (!room) return {};
          const g = room.geometry;
          const dim = dir === "x" ? g.width : g.depth;
          const p = Math.round(Math.min(Math.max(pos, 0.5), dim - 0.5) * 10) / 10;
          const mk = (name: string, geom: Room["geometry"], furniture: Room["furniture"]): Room => ({
            ...room,
            id: nextId(),
            name,
            geometry: geom,
            selections: JSON.parse(JSON.stringify(room.selections)),
            tasks: room.tasks.map((t) => ({ ...t })),
            confidence: "medium",
            furniture,
          });
          // partition the furniture by which side of the new wall it sits on
          const items = room.furniture ?? [];
          const clampTo = (v: number, max: number) => Math.min(Math.max(v, 0.35), max - 0.35);
          const [fa, fb] =
            dir === "x"
              ? [
                  items.filter((f) => f.x <= p).map((f) => ({ ...f, x: clampTo(f.x, p) })),
                  items.filter((f) => f.x > p).map((f) => ({ ...f, x: clampTo(f.x - p, g.width - p) })),
                ]
              : [
                  items.filter((f) => f.z <= p).map((f) => ({ ...f, z: clampTo(f.z, p) })),
                  items.filter((f) => f.z > p).map((f) => ({ ...f, z: clampTo(f.z - p, g.depth - p) })),
                ];
          const a =
            dir === "x"
              ? mk(`${room.name} A`, { ...g, width: p }, fa)
              : mk(`${room.name} A`, { ...g, depth: p }, fa);
          const b =
            dir === "x"
              ? mk(`${room.name} B`, { ...g, x: g.x + p, width: Math.round((g.width - p) * 10) / 10 }, fb)
              : mk(`${room.name} B`, { ...g, z: g.z + p, depth: Math.round((g.depth - p) * 10) / 10 }, fb);
          const baseline = s.baseline
            ? {
                ...Object.fromEntries(Object.entries(s.baseline).filter(([k]) => k !== roomId)),
                [a.id]: JSON.parse(JSON.stringify(a.selections)),
                [b.id]: JSON.parse(JSON.stringify(b.selections)),
              }
            : s.baseline;
          get().logChange(`Split ${room.name} with a new stud wall`);
          return {
            rooms: [...s.rooms.filter((r) => r.id !== roomId), a, b],
            baseline,
            selectedRoomId: null,
            structTarget: null,
            variations: s.variations.filter((v) => v.roomId !== roomId),
          };
        }),

      changes: [],
      logChange: (text) =>
        set((s) => ({ changes: [{ at: now(), text }, ...s.changes].slice(0, 30) })),

      resetProject: () =>
        set({
          plan: null,
          draftRooms: [],
          rooms: [],
          baseline: null,
          variations: [],
          changes: [],
          structuralWorks: [],
          reworkCharges: [],
          structTarget: null,
          modelMode: "pricing",
          selectedRoomId: null,
          screen: "upload",
        }),
    }),
    {
      name: "building-works-pricing",
      // Persisted rate libraries from older versions of the app may lack
      // newly added rates (e.g. the Structural category) — append any
      // defaults that are missing so new features always price correctly.
      merge: (persisted, current) => {
        const p = persisted as Partial<ProjectState> | undefined;
        const merged = { ...current, ...(p ?? {}) };
        const have = new Set((merged.rates ?? []).map((r) => r.id));
        merged.rates = [...(merged.rates ?? []), ...DEFAULT_RATES.filter((r) => !have.has(r.id))];
        // older saves predate movable furniture — generate default layouts
        merged.rooms = (merged.rooms ?? []).map((r) =>
          r.furniture?.length ? r : { ...r, furniture: defaultFurniture(r) },
        );
        return merged;
      },
      partialize: (s) => ({
        projectName: s.projectName,
        plan: s.plan,
        draftRooms: s.draftRooms,
        rooms: s.rooms,
        baseline: s.baseline,
        variations: s.variations,
        rates: s.rates,
        theme: s.theme,
        changes: s.changes,
        structuralWorks: s.structuralWorks,
        reworkCharges: s.reworkCharges,
        screen: s.screen === "confirm" ? "upload" : s.screen,
      }),
    },
  ),
);

// Dev/debug convenience: inspect or drive the store from the browser console,
// e.g. __store.getState().addStructuralWork(...). Harmless in production.
if (typeof window !== "undefined") {
  (window as unknown as { __store: typeof useStore }).__store = useStore;
}

import { useEffect, useMemo, useState } from "react";
import { Combine, DoorOpen, Hammer, Scissors, Trash2, TriangleAlert, Undo2, X } from "lucide-react";
import { useStore } from "../store";
import {
  adjacentRoom,
  structuralCost,
  structuralSubtotal,
} from "../lib/structural";
import { DOOR_HEIGHT_M, GARDEN_DOOR_SPECS } from "../data/pricing";
import { deriveRoom } from "../lib/pricingEngine";
import { gbp } from "../lib/format";
import { SectionTitle } from "./ui";
import type { StructuralWork } from "../types";

/**
 * Structural renovate mode UI:
 *  - StructuralWorksPanel: right-hand running list of costed structural items
 *  - StructuralActionCard: contextual actions for the clicked wall / room
 */

export function StructuralWorksPanel() {
  const works = useStore((s) => s.structuralWorks);
  const rates = useStore((s) => s.rates);
  const deleteWork = useStore((s) => s.deleteStructuralWork);
  const subtotal = structuralSubtotal(works, rates);

  return (
    <div className="w-full md:w-[340px] shrink-0 h-[38vh] md:h-full bg-white border-t md:border-t-0 md:border-l border-stone-200 flex flex-col overflow-hidden">
      <div className="px-4 pt-4 pb-3 border-b border-stone-200">
        <h2 className="font-semibold text-stone-800 flex items-center gap-2">
          <Hammer className="w-4 h-4 text-rose-500" />
          Structural works
        </h2>
        <p className="text-xs text-stone-500 mt-1">
          Click a <b>wall</b> in the model to remove it or fit garden doors; click a <b>floor</b> to demolish or
          split the room.
        </p>
        <div className="mt-3 flex items-end justify-between">
          <span className="text-[11px] uppercase tracking-wider text-stone-400 font-semibold">Structural subtotal</span>
          <span className="text-2xl font-bold text-stone-900 tabular-nums">{gbp(subtotal)}</span>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {works.length === 0 && (
          <p className="text-sm text-stone-400 px-1 py-4 text-center">
            No structural works yet.
            <br />
            Try removing the wall between the Kitchen and Dining Area.
          </p>
        )}
        {works.map((w) => (
          <WorkRow key={w.id} work={w} onDelete={() => deleteWork(w.id)} />
        ))}
        {works.some((w) => w.type === "remove_wall" && !w.edge) && (
          <p className="text-[10px] text-stone-400 px-1">
            Deleting a merge's wall-removal item removes its cost only — merged rooms stay merged.
          </p>
        )}
      </div>
      <div className="border-t border-stone-200 px-4 py-3 bg-stone-50 text-[10px] leading-relaxed text-stone-400">
        Load-bearing removals include steel + structural engineer allowance. All structural costs assume standard
        access and exclude planning/building-control fees.
      </div>
    </div>
  );
}

function WorkRow({ work, onDelete }: { work: StructuralWork; onDelete: () => void }) {
  const rates = useStore((s) => s.rates);
  const cost = structuralCost(work, rates);
  const icon =
    work.type === "garden_doors" ? <DoorOpen className="w-3.5 h-3.5 text-sky-600" /> :
    work.type === "add_wall" ? <Scissors className="w-3.5 h-3.5 text-emerald-600" /> :
    work.type === "demolish_room" ? <TriangleAlert className="w-3.5 h-3.5 text-rose-500" /> :
    <Hammer className="w-3.5 h-3.5 text-amber-600" />;
  return (
    <div className="rounded-lg border border-stone-200 bg-white p-2.5 flex items-start gap-2">
      <span className="mt-0.5 shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium text-stone-700 leading-snug">{work.label}</div>
        <div className="text-[10px] text-stone-400 mt-0.5">
          {work.type === "demolish_room"
            ? `${work.areaM2} m² strip-out`
            : work.lengthM
              ? `${work.lengthM} m × ${work.heightM ?? DOOR_HEIGHT_M} m${work.loadBearing ? " · load-bearing" : ""}`
              : ""}
        </div>
      </div>
      <span className="text-sm font-semibold text-stone-900 tabular-nums shrink-0">{gbp(cost)}</span>
      <button onClick={onDelete} title="Remove this work item" className="text-stone-300 hover:text-rose-500 shrink-0">
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

/** Bottom-centre contextual card for the clicked wall / room. */
export function StructuralActionCard() {
  const target = useStore((s) => s.structTarget);
  const rooms = useStore((s) => s.rooms);
  const rates = useStore((s) => s.rates);
  const works = useStore((s) => s.structuralWorks);
  const setTarget = useStore((s) => s.setStructTarget);
  const addWork = useStore((s) => s.addStructuralWork);
  const deleteWork = useStore((s) => s.deleteStructuralWork);
  const mergeLiveRooms = useStore((s) => s.mergeLiveRooms);
  const splitLiveRoom = useStore((s) => s.splitLiveRoom);
  const setWallDraft = useStore((s) => s.setWallDraft);

  const [loadBearing, setLoadBearing] = useState(false);
  const [doorWidth, setDoorWidth] = useState(2.4);
  const [wallDir, setWallDir] = useState<"x" | "z">("x");
  const [wallPos, setWallPos] = useState(1.5);

  const room = rooms.find((r) => r.id === target?.roomId);
  const adj = useMemo(
    () => (room && target?.edge ? adjacentRoom(room, target.edge, rooms) : null),
    [room, target, rooms],
  );

  const doorsHere = useMemo(
    () =>
      room && target?.edge
        ? works.find((w) => w.type === "garden_doors" && w.roomId === room.id && w.edge === target.edge)
        : undefined,
    [works, room, target],
  );

  // When the card opens on a wall with doors already fitted, pick up their
  // width so the slider resizes the existing doors.
  useEffect(() => {
    if (!room || !target?.edge) return;
    setDoorWidth(doorsHere?.lengthM ?? 2.4);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target?.roomId, target?.edge]);

  // When the card opens on a ROOM, initialise the add-wall draft (live 3D
  // preview) at the midpoint of the longer dimension.
  useEffect(() => {
    if (!room || !target || target.edge) return;
    const dir: "x" | "z" = room.geometry.width >= room.geometry.depth ? "x" : "z";
    const dim = dir === "x" ? room.geometry.width : room.geometry.depth;
    setWallDir(dir);
    setWallPos(Math.round((dim / 2) * 10) / 10);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target?.roomId, target?.edge]);

  // Push the draft into the store so the 3D scene shows the ghost wall.
  useEffect(() => {
    if (room && target && !target.edge) {
      setWallDraft({ roomId: room.id, dir: wallDir, pos: wallPos });
      return () => setWallDraft(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.id, target, wallDir, wallPos]);

  if (!target || !room) return null;

  const rate = (id: string) => rates.find((r) => r.id === id)?.rate ?? 0;
  const h = room.geometry.height;

  const card = (title: string, children: React.ReactNode) => (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-[430px] max-w-[92%] bg-white/95 backdrop-blur rounded-xl border border-stone-300 shadow-xl p-4">
      <div className="flex items-center justify-between mb-2.5">
        <h3 className="text-sm font-semibold text-stone-800">{title}</h3>
        <button onClick={() => setTarget(null)} className="text-stone-400 hover:text-stone-600">
          <X className="w-4 h-4" />
        </button>
      </div>
      {children}
    </div>
  );

  // ---------- wall target ----------
  if (target.edge) {
    // wall shared with another room → remove / merge
    if (adj) {
      const existing = works.find(
        (w) => w.type === "remove_wall" && ((w.roomId === room.id && w.edge === target.edge) || w.targetRoomId === room.id),
      );
      const wallArea = adj.length * h;
      const cost = Math.round(wallArea * rate(loadBearing ? "demo_load" : "demo_stud"));
      const label = `Remove wall: ${room.name} ↔ ${adj.room.name}`;
      return card(`Wall between ${room.name} and ${adj.room.name}`, (
        <>
          <p className="text-xs text-stone-500">
            {adj.length.toFixed(1)} m shared wall · {wallArea.toFixed(1)} m² @ £
            {rate(loadBearing ? "demo_load" : "demo_stud")}/m²
          </p>
          <label className="mt-2 flex items-center gap-2 text-xs text-stone-600 cursor-pointer">
            <input type="checkbox" checked={loadBearing} onChange={(e) => setLoadBearing(e.target.checked)} className="accent-rose-500" />
            Load-bearing (adds steel beam + engineer)
          </label>
          {existing ? (
            <button
              onClick={() => {
                deleteWork(existing.id);
                setTarget(null);
              }}
              className="mt-3 w-full inline-flex items-center justify-center gap-1.5 text-xs font-semibold bg-stone-100 hover:bg-stone-200 text-stone-700 px-3 py-2.5 rounded-lg"
            >
              <Undo2 className="w-3.5 h-3.5" /> Reinstate this wall (remove the demolition item)
            </button>
          ) : (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                onClick={() =>
                  addWork({
                    type: "remove_wall",
                    label,
                    roomId: room.id,
                    targetRoomId: adj.room.id,
                    edge: target.edge,
                    lengthM: Math.round(adj.length * 10) / 10,
                    heightM: h,
                    loadBearing,
                  })
                }
                className="inline-flex items-center justify-center gap-1.5 text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-white px-3 py-2.5 rounded-lg"
              >
                <Hammer className="w-3.5 h-3.5" /> Remove wall · {gbp(cost)}
              </button>
              <button
                onClick={() => {
                  addWork({
                    type: "remove_wall",
                    label: `Remove wall & merge: ${room.name} + ${adj.room.name}`,
                    roomId: room.id,
                    targetRoomId: adj.room.id,
                    edge: target.edge,
                    lengthM: Math.round(adj.length * 10) / 10,
                    heightM: h,
                    loadBearing,
                  });
                  mergeLiveRooms(room.id, adj.room.id);
                }}
                className="inline-flex items-center justify-center gap-1.5 text-xs font-semibold bg-rose-500 hover:bg-rose-600 text-white px-3 py-2.5 rounded-lg"
              >
                <Combine className="w-3.5 h-3.5" /> Remove & merge · {gbp(cost)}
              </button>
            </div>
          )}
        </>
      ));
    }

    // exterior wall → garden doors (fit or live-resize)
    const wallLen = target.edge === "N" || target.edge === "S" ? room.geometry.width : room.geometry.depth;
    const maxW = Math.max(1.2, Math.round((wallLen - 0.5) * 10) / 10);
    const existingDoors = doorsHere;
    const width = Math.min(doorWidth, maxW);
    /** Commit the current slider width to the fitted doors (replaces in place). */
    const resizeFitted = () => {
      if (!existingDoors) return;
      addWork({
        type: "garden_doors",
        label: `Garden doors (${GARDEN_DOOR_SPECS.find((s) => s.id === existingDoors.specId)?.label}): ${room.name}`,
        roomId: room.id,
        edge: target.edge,
        lengthM: Math.round(width * 10) / 10,
        heightM: DOOR_HEIGHT_M,
        specId: existingDoors.specId,
      });
    };
    return card(`Exterior wall — ${room.name}`, (
      <>
        <p className="text-xs text-stone-500">
          Form a structural opening and fit glazed garden doors (opening {DOOR_HEIGHT_M} m high, incl. lintel @ £
          {rate("lintel")}/m).
        </p>
        <div className="mt-2.5 flex items-center gap-2 text-xs text-stone-600">
          <span className="shrink-0">Opening width</span>
          <input
            type="range"
            min={1.2}
            max={maxW}
            step={0.1}
            value={width}
            onChange={(e) => setDoorWidth(parseFloat(e.target.value))}
            onPointerUp={resizeFitted}
            className="flex-1 accent-sky-600"
          />
          <span className="w-12 text-right font-semibold text-stone-800 tabular-nums">{width.toFixed(1)} m</span>
        </div>
        {existingDoors && (
          <p className="mt-1 text-[10px] text-sky-600">
            Doors fitted — drag the slider to resize them (price updates live).
          </p>
        )}
        <div className="mt-2.5 space-y-1.5">
          {GARDEN_DOOR_SPECS.map((spec) => {
            const w = Math.min(doorWidth, maxW);
            const cost = Math.round(w * DOOR_HEIGHT_M * rate(spec.rateId) + w * rate("lintel"));
            const active = existingDoors?.specId === spec.id;
            return (
              <button
                key={spec.id}
                onClick={() =>
                  addWork({
                    type: "garden_doors",
                    label: `Garden doors (${spec.label}): ${room.name}`,
                    roomId: room.id,
                    edge: target.edge,
                    lengthM: w,
                    heightM: DOOR_HEIGHT_M,
                    specId: spec.id,
                  })
                }
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg border text-left transition-colors ${
                  active ? "border-sky-400 bg-sky-50" : "border-stone-200 hover:border-stone-300 bg-white"
                }`}
              >
                <span className="w-4 h-4 rounded-sm border shrink-0" style={{ background: spec.frameColor }} />
                <span className="flex-1 min-w-0">
                  <span className="block text-xs font-semibold text-stone-800">{spec.label}{active ? " — fitted" : ""}</span>
                  <span className="block text-[10px] text-stone-400 truncate">{spec.assumption}</span>
                </span>
                <span className="text-xs font-semibold text-stone-900 tabular-nums">{gbp(cost)}</span>
              </button>
            );
          })}
        </div>
        {existingDoors && (
          <button
            onClick={() => {
              deleteWork(existingDoors.id);
              setTarget(null);
            }}
            className="mt-2 w-full text-[11px] text-stone-400 hover:text-rose-500"
          >
            Remove the fitted doors
          </button>
        )}
      </>
    ));
  }

  // ---------- room target ----------
  const derived = deriveRoom(room);
  const demoWork = works.find((w) => w.type === "demolish_room" && w.roomId === room.id);
  const demoCost = Math.round(derived.floorArea * rate("demo_room"));
  // new wall runs perpendicular to the chosen position axis
  const wallRun = wallDir === "x" ? room.geometry.depth : room.geometry.width;
  const posMax = (wallDir === "x" ? room.geometry.width : room.geometry.depth) - 0.6;
  const pos = Math.min(Math.max(wallPos, 0.6), Math.max(0.6, posMax));
  const wallCost = Math.round(wallRun * h * rate("build_stud"));
  const sideA = pos.toFixed(1);
  const sideB = ((wallDir === "x" ? room.geometry.width : room.geometry.depth) - pos).toFixed(1);
  return card(`${room.name} — structural actions`, (
    <div className="space-y-2">
      {demoWork ? (
        <button
          onClick={() => {
            deleteWork(demoWork.id);
            setTarget(null);
          }}
          className="w-full inline-flex items-center justify-center gap-1.5 text-xs font-semibold bg-stone-100 hover:bg-stone-200 text-stone-700 px-3 py-2.5 rounded-lg"
        >
          <Undo2 className="w-3.5 h-3.5" /> Undo demolition of {room.name}
        </button>
      ) : (
        <button
          onClick={() =>
            addWork({
              type: "demolish_room",
              label: `Demolition & strip-out: ${room.name}`,
              roomId: room.id,
              areaM2: derived.floorArea,
            })
          }
          className="w-full inline-flex items-center justify-center gap-1.5 text-xs font-semibold bg-rose-500 hover:bg-rose-600 text-white px-3 py-2.5 rounded-lg"
        >
          <TriangleAlert className="w-3.5 h-3.5" /> Demolish / strip out {room.name} · {gbp(demoCost)}
        </button>
      )}
      {/* add a wall — direction + position with live ghost preview in 3D */}
      <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-emerald-800 inline-flex items-center gap-1.5">
            <Scissors className="w-3.5 h-3.5" /> Add a new wall
          </span>
          <div className="flex rounded-md overflow-hidden border border-emerald-300">
            {(
              [
                ["x", "Front–back"],
                ["z", "Side–side"],
              ] as const
            ).map(([dir, label]) => (
              <button
                key={dir}
                onClick={() => {
                  setWallDir(dir);
                  const dim = dir === "x" ? room.geometry.width : room.geometry.depth;
                  setWallPos(Math.round((dim / 2) * 10) / 10);
                }}
                className={`px-2 py-1 text-[10px] font-semibold ${
                  wallDir === dir ? "bg-emerald-600 text-white" : "bg-white text-emerald-700"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-2 flex items-center gap-2 text-xs text-stone-600">
          <span className="shrink-0">Position</span>
          <input
            type="range"
            min={0.6}
            max={Math.max(0.6, posMax)}
            step={0.1}
            value={pos}
            onChange={(e) => setWallPos(parseFloat(e.target.value))}
            className="flex-1 accent-emerald-600"
          />
          <span className="w-20 text-right text-[10px] text-stone-500 tabular-nums">
            {sideA} m | {sideB} m
          </span>
        </div>
        <button
          onClick={() => {
            addWork({
              type: "add_wall",
              label: `New stud wall in ${room.name} (${sideA} m / ${sideB} m split)`,
              roomId: room.id,
              lengthM: Math.round(wallRun * 10) / 10,
              heightM: h,
            });
            splitLiveRoom(room.id, wallDir, pos);
            setWallDraft(null);
          }}
          className="mt-2 w-full inline-flex items-center justify-center gap-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 rounded-lg"
        >
          Build wall here · {gbp(wallCost)}
        </button>
      </div>
      <p className="text-[10px] text-stone-400">
        Demolition strips fittings, finishes and services back to shell ({derived.floorArea} m² @ £{rate("demo_room")}
        /m²). The new wall is a boarded & skimmed {wallRun.toFixed(1)} m stud partition — the green ghost in the model
        shows where it will go.
      </p>
    </div>
  ));
}

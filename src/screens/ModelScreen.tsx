import { useMemo } from "react";
import { Box, Building2, Hammer, Layers, Moon, Mountain, Palette, PoundSterling, Video } from "lucide-react";
import { useStore, type FloorFilter } from "../store";
import Scene from "../three/Scene";
import RoomPricingPanel from "../components/RoomPricingPanel";
import { StructuralActionCard, StructuralWorksPanel } from "../components/StructuralPanel";
import { projectTotals, roomSubtotal } from "../lib/pricingEngine";
import { gbp, FLOOR_LABEL } from "../lib/format";
import { THEMES } from "../three/themes";
import type { ThemeId } from "../types";
import { ProgressBar } from "../components/ui";

/**
 * The Scope Model screen: room list (left) · 3D cutaway (centre) · pricing
 * panel or structural-works panel (right) · price summary (bottom-left).
 * Two modes: "pricing" (select rooms, choose options) and "structural"
 * (per-floor wall editing: remove/add walls, merge rooms, garden doors).
 */
export default function ModelScreen() {
  const rooms = useStore((s) => s.rooms);
  const rates = useStore((s) => s.rates);
  const selectedRoomId = useStore((s) => s.selectedRoomId);
  const selectRoom = useStore((s) => s.selectRoom);
  const hoveredRoomId = useStore((s) => s.hoveredRoomId);
  const hoverRoom = useStore((s) => s.hoverRoom);
  const floorFilter = useStore((s) => s.floorFilter);
  const setFloorFilter = useStore((s) => s.setFloorFilter);
  const theme = useStore((s) => s.theme);
  const setTheme = useStore((s) => s.setTheme);
  const cameraMode = useStore((s) => s.cameraMode);
  const setCameraMode = useStore((s) => s.setCameraMode);
  const setScreen = useStore((s) => s.setScreen);
  const modelMode = useStore((s) => s.modelMode);
  const setModelMode = useStore((s) => s.setModelMode);
  const structuralWorks = useStore((s) => s.structuralWorks);
  const structTarget = useStore((s) => s.structTarget);

  const structuralMode = modelMode === "structural";
  const selected = rooms.find((r) => r.id === selectedRoomId) ?? null;
  const totals = useMemo(() => projectTotals(rooms, rates, structuralWorks), [rooms, rates, structuralWorks]);

  const floors: Array<{ id: FloorFilter; label: string }> = [
    { id: "ground", label: "Ground" },
    { id: "first", label: "First" },
    ...(structuralMode ? [] : [{ id: "all" as FloorFilter, label: "Whole house" }]),
  ];

  if (rooms.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 text-stone-500">
        <Building2 className="w-10 h-10 text-stone-300" />
        <p className="text-sm">No model yet — upload a plan and confirm the rooms first.</p>
        <button
          onClick={() => setScreen("upload")}
          className="text-sm font-semibold text-amber-700 hover:text-amber-800 underline underline-offset-4"
        >
          Go to Plan Upload
        </button>
      </div>
    );
  }

  return (
    <div className="h-full flex overflow-hidden">
      {/* left: room list */}
      <div className="w-72 shrink-0 bg-white border-r border-stone-200 flex flex-col">
        <div className="px-4 py-3 border-b border-stone-200">
          <h2 className="font-semibold text-sm text-stone-800">Rooms</h2>
          <p className="text-[11px] text-stone-400">
            {structuralMode
              ? "Structural mode — click walls & floors in the model"
              : "Click a room to price it · drag furniture to rearrange (free)"}
          </p>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-4">
          {(["ground", "first", "second"] as const)
            .map((f) => ({ f, list: rooms.filter((r) => r.floor === f) }))
            .filter(({ list }) => list.length)
            .map(({ f, list }) => (
              <div key={f}>
                <h3 className="px-2 text-[10px] font-semibold uppercase tracking-wider text-stone-400 mb-1">
                  {FLOOR_LABEL[f]}
                </h3>
                {list.map((room) => {
                  const sub = roomSubtotal(room, rates);
                  const done = room.tasks.filter((t) => t.status === "complete" || t.status === "approved").length;
                  const active = room.id === selectedRoomId;
                  const demolished = structuralWorks.some((w) => w.type === "demolish_room" && w.roomId === room.id);
                  return (
                    <button
                      key={room.id}
                      onClick={() => {
                        if (structuralMode) {
                          if (floorFilter !== room.floor) setFloorFilter(room.floor);
                          useStore.getState().setStructTarget({ roomId: room.id });
                        } else {
                          selectRoom(active ? null : room.id);
                        }
                      }}
                      onMouseEnter={() => hoverRoom(room.id)}
                      onMouseLeave={() => hoverRoom(null)}
                      className={`w-full text-left px-2.5 py-2 rounded-lg mb-1 transition-colors border ${
                        active
                          ? "bg-amber-50 border-amber-300"
                          : room.id === hoveredRoomId
                            ? "bg-stone-50 border-stone-200"
                            : "border-transparent hover:bg-stone-50"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className={`text-sm font-medium truncate ${demolished ? "line-through text-rose-400" : "text-stone-800"}`}>
                          {room.name}
                        </span>
                        <span className="text-xs text-stone-500 tabular-nums shrink-0">{gbp(sub)}</span>
                      </div>
                      <ProgressBar value={done / room.tasks.length} className="mt-1.5" />
                    </button>
                  );
                })}
              </div>
            ))}
        </div>

        {/* whole-house summary */}
        <div className="border-t border-stone-200 p-4 bg-stone-50">
          <div className="space-y-1 text-xs text-stone-500">
            <Row label="Room works" value={gbp(totals.rooms)} />
            <Row label="Structural works" value={gbp(totals.structural)} highlight={totals.structural > 0} />
            <Row label="Margin" value={gbp(totals.margin)} />
            <Row label="VAT" value={gbp(totals.vat)} />
          </div>
          <div className="mt-2 pt-2 border-t border-stone-200 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-stone-500">Project total</span>
            <span className="text-xl font-bold text-stone-900 tabular-nums">{gbp(totals.total)}</span>
          </div>
        </div>
      </div>

      {/* centre: 3D canvas + floating controls */}
      <div className="flex-1 relative min-w-0">
        <Scene />

        {/* mode toggle — top centre */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 flex rounded-lg overflow-hidden border border-stone-300/60 shadow-md bg-white/90 backdrop-blur">
          <button
            onClick={() => setModelMode("pricing")}
            className={`px-4 py-1.5 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors ${
              !structuralMode ? "bg-stone-800 text-white" : "text-stone-600 hover:bg-stone-100"
            }`}
          >
            <PoundSterling className="w-3.5 h-3.5" /> Pricing
          </button>
          <button
            onClick={() => setModelMode("structural")}
            className={`px-4 py-1.5 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors ${
              structuralMode ? "bg-rose-600 text-white" : "text-stone-600 hover:bg-stone-100"
            }`}
          >
            <Hammer className="w-3.5 h-3.5" /> Structural
          </button>
        </div>

        {/* floor toggle */}
        <div className="absolute top-4 left-4 flex rounded-lg overflow-hidden border border-stone-300/60 shadow-sm bg-white/90 backdrop-blur">
          {floors.map((f) => (
            <button
              key={f.id}
              onClick={() => setFloorFilter(f.id)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                floorFilter === f.id ? "bg-stone-800 text-white" : "text-stone-600 hover:bg-stone-100"
              }`}
            >
              <Layers className="w-3 h-3 inline mr-1 -mt-0.5" />
              {f.label}
            </button>
          ))}
        </div>

        {/* theme + camera */}
        <div className="absolute top-4 right-4 flex gap-2">
          <div className="flex rounded-lg overflow-hidden border border-stone-300/60 shadow-sm bg-white/90 backdrop-blur">
            {(Object.keys(THEMES) as ThemeId[]).map((t) => {
              const Icon = t === "dollhouse" ? Palette : t === "architectural" ? Box : Moon;
              return (
                <button
                  key={t}
                  onClick={() => setTheme(t)}
                  title={THEMES[t].name}
                  className={`px-2.5 py-1.5 text-xs transition-colors ${
                    theme === t ? "bg-stone-800 text-white" : "text-stone-600 hover:bg-stone-100"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                </button>
              );
            })}
          </div>
          <button
            onClick={() => setCameraMode(cameraMode === "iso" ? "top" : "iso")}
            title={cameraMode === "iso" ? "Switch to top-down" : "Switch to isometric"}
            className="px-2.5 py-1.5 rounded-lg border border-stone-300/60 shadow-sm bg-white/90 backdrop-blur text-stone-600 hover:bg-stone-100 text-xs inline-flex items-center gap-1.5"
          >
            {cameraMode === "iso" ? <Video className="w-3.5 h-3.5" /> : <Mountain className="w-3.5 h-3.5" />}
            {cameraMode === "iso" ? "Isometric" : "Top-down"}
          </button>
        </div>

        {/* structural hint bar */}
        {structuralMode && !structTarget && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full bg-rose-600/90 text-white text-xs font-medium shadow-lg backdrop-blur pointer-events-none">
            Structural mode · {FLOOR_LABEL[floorFilter]} — click a wall to remove it or fit doors, click a floor to
            demolish, split or add a wall
          </div>
        )}

        {/* focus-mode breadcrumb (pricing mode) */}
        {!structuralMode && selected && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
            <button
              onClick={() => selectRoom(null)}
              className="px-4 py-2 rounded-full bg-stone-900/85 text-white text-xs font-medium shadow-lg backdrop-blur hover:bg-stone-800"
            >
              Focused on {selected.name} — click to show whole house
            </button>
          </div>
        )}

        {/* structural contextual action card */}
        {structuralMode && <StructuralActionCard />}
      </div>

      {/* right panel */}
      {structuralMode ? <StructuralWorksPanel /> : selected && <RoomPricingPanel key={selected.id} room={selected} />}
    </div>
  );
}

function Row({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`flex items-center justify-between ${highlight ? "text-rose-600 font-medium" : ""}`}>
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

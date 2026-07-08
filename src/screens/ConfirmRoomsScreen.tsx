import { useEffect, useMemo, useState } from "react";
import { Boxes, Combine, Loader2, Plus, Scissors, Trash2 } from "lucide-react";
import { useStore } from "../store";
import { loadPdf, renderPage } from "../lib/pdf";
import { deriveRoom } from "../lib/pricingEngine";
import type { ExtractedRoom, FloorLevel } from "../types";
import { ConfidenceBadge, NumInput } from "../components/ui";
import { FLOOR_LABEL } from "../lib/format";

/**
 * Confirm Rooms — PDF on the left, extracted room list on the right.
 * The user corrects the machine's guess before the 3D model is generated.
 */
export default function ConfirmRoomsScreen() {
  const plan = useStore((s) => s.plan);
  const draftRooms = useStore((s) => s.draftRooms);
  const updateDraftRoom = useStore((s) => s.updateDraftRoom);
  const addDraftRoom = useStore((s) => s.addDraftRoom);
  const deleteDraftRoom = useStore((s) => s.deleteDraftRoom);
  const mergeDraftRooms = useStore((s) => s.mergeDraftRooms);
  const splitDraftRoom = useStore((s) => s.splitDraftRoom);
  const confirmRooms = useStore((s) => s.confirmRooms);
  const setScreen = useStore((s) => s.setScreen);

  const [previewPage, setPreviewPage] = useState<number>(() => {
    const g = plan?.pages.find((p) => p.kind === "ground");
    return g ? g.index : 0;
  });
  const [preview, setPreview] = useState<string | null>(null);
  const [checked, setChecked] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!plan) return;
      const pdf = await loadPdf(plan.dataUrl);
      const img = await renderPage(pdf, previewPage, 1000);
      if (!cancelled) setPreview(img);
    })();
    return () => {
      cancelled = true;
    };
  }, [plan, previewPage]);

  const byFloor = useMemo(() => {
    const floors: FloorLevel[] = ["ground", "first", "second"];
    return floors
      .map((f) => ({ floor: f, rooms: draftRooms.filter((r) => r.floor === f) }))
      .filter((g) => g.rooms.length > 0 || g.floor !== "second");
  }, [draftRooms]);

  const toggleCheck = (id: string) =>
    setChecked((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));

  if (!plan) {
    return (
      <div className="h-full flex items-center justify-center text-stone-500 text-sm">
        Upload a plan first.
      </div>
    );
  }

  return (
    <div className="h-full flex overflow-hidden">
      {/* left: PDF preview */}
      <div className="w-[46%] shrink-0 border-r border-stone-200 bg-stone-100 flex flex-col">
        <div className="px-4 py-2.5 bg-white border-b border-stone-200 flex gap-2 items-center overflow-x-auto">
          {plan.pages
            .filter((p) => p.kind === "ground" || p.kind === "first")
            .map((p) => (
              <button
                key={p.index}
                onClick={() => setPreviewPage(p.index)}
                className={`text-xs px-3 py-1.5 rounded-full border whitespace-nowrap transition-colors ${
                  previewPage === p.index
                    ? "bg-stone-800 text-white border-stone-800"
                    : "bg-white text-stone-600 border-stone-300 hover:border-stone-400"
                }`}
              >
                {p.label}
              </button>
            ))}
        </div>
        <div className="flex-1 overflow-auto p-4 flex items-start justify-center">
          {preview ? (
            <img src={preview} alt="plan" className="max-w-full rounded-lg shadow border border-stone-200 bg-white" />
          ) : (
            <Loader2 className="w-7 h-7 text-stone-400 animate-spin mt-16" />
          )}
        </div>
      </div>

      {/* right: room list editor */}
      <div className="flex-1 flex flex-col overflow-hidden bg-white">
        <div className="px-6 py-4 border-b border-stone-200 flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-stone-800">Confirm rooms</h2>
            <p className="text-xs text-stone-500 mt-0.5">
              {draftRooms.length} rooms read from the plan — rename, correct sizes, merge open-plan spaces.
            </p>
          </div>
          {checked.length >= 2 && (
            <button
              onClick={() => {
                mergeDraftRooms(checked);
                setChecked([]);
              }}
              className="inline-flex items-center gap-1.5 text-xs font-semibold bg-sky-600 hover:bg-sky-700 text-white px-3 py-2 rounded-lg"
            >
              <Combine className="w-3.5 h-3.5" /> Merge {checked.length} rooms
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
          {byFloor.map(({ floor, rooms }) => (
            <div key={floor}>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-stone-400">
                  {FLOOR_LABEL[floor]} · {rooms.length}
                </h3>
                <button
                  onClick={() => addDraftRoom(floor)}
                  className="inline-flex items-center gap-1 text-xs text-amber-700 hover:text-amber-800"
                >
                  <Plus className="w-3.5 h-3.5" /> Add room
                </button>
              </div>
              <div className="space-y-2">
                {rooms.map((room) => (
                  <RoomRow
                    key={room.id}
                    room={room}
                    checked={checked.includes(room.id)}
                    onCheck={() => toggleCheck(room.id)}
                    onChange={(patch) => updateDraftRoom(room.id, patch)}
                    onDelete={() => deleteDraftRoom(room.id)}
                    onSplit={() => splitDraftRoom(room.id)}
                  />
                ))}
                {rooms.length === 0 && (
                  <p className="text-xs text-stone-400 italic py-2">No rooms on this floor yet.</p>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-stone-200 px-6 py-4 flex items-center justify-between bg-stone-50">
          <button onClick={() => setScreen("upload")} className="text-sm text-stone-500 hover:text-stone-700">
            ← Back to pages
          </button>
          <button
            onClick={confirmRooms}
            disabled={draftRooms.length === 0}
            className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-white font-semibold text-sm px-5 py-2.5 rounded-lg shadow-sm"
          >
            <Boxes className="w-4 h-4" />
            Generate 3D model
          </button>
        </div>
      </div>
    </div>
  );
}

function RoomRow({
  room,
  checked,
  onCheck,
  onChange,
  onDelete,
  onSplit,
}: {
  room: ExtractedRoom;
  checked: boolean;
  onCheck: () => void;
  onChange: (patch: Partial<ExtractedRoom>) => void;
  onDelete: () => void;
  onSplit: () => void;
}) {
  const derived = deriveRoom({ geometry: room.geometry, doors: room.doors, windows: room.windows });
  return (
    <div className={`rounded-lg border p-3 transition-colors ${checked ? "border-sky-400 bg-sky-50/50" : "border-stone-200 bg-white"}`}>
      <div className="flex items-center gap-2">
        <input type="checkbox" checked={checked} onChange={onCheck} className="accent-sky-600" title="Select to merge" />
        <input
          value={room.name}
          onChange={(e) => onChange({ name: e.target.value })}
          className="flex-1 font-medium text-sm text-stone-800 border border-transparent hover:border-stone-300 focus:border-amber-400 rounded-md px-1.5 py-1 focus:outline-none bg-transparent"
        />
        <ConfidenceBadge level={room.confidence} />
        <select
          value={room.floor}
          onChange={(e) => onChange({ floor: e.target.value as FloorLevel })}
          className="text-xs border border-stone-300 rounded-md px-1.5 py-1 bg-white"
        >
          <option value="ground">Ground</option>
          <option value="first">First</option>
          <option value="second">Second</option>
        </select>
        <button onClick={onSplit} title="Split room" className="text-stone-400 hover:text-sky-600 p-1">
          <Scissors className="w-3.5 h-3.5" />
        </button>
        <button onClick={onDelete} title="Delete room" className="text-stone-400 hover:text-rose-500 p-1">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-stone-500 pl-6">
        <span className="inline-flex items-center gap-1">
          <NumInput value={room.geometry.width} onChange={(v) => onChange({ geometry: { ...room.geometry, width: v } })} className="w-14" />
          ×
          <NumInput value={room.geometry.depth} onChange={(v) => onChange({ geometry: { ...room.geometry, depth: v } })} className="w-14" />
          m
        </span>
        <span className="inline-flex items-center gap-1">
          ceiling
          <NumInput value={room.geometry.height} onChange={(v) => onChange({ geometry: { ...room.geometry, height: v } })} className="w-14" step={0.05} />
          m
        </span>
        <span className="inline-flex items-center gap-1">
          doors
          <NumInput value={room.doors} onChange={(v) => onChange({ doors: Math.round(v) })} className="w-11" step={1} />
        </span>
        <span className="inline-flex items-center gap-1">
          windows
          <NumInput value={room.windows} onChange={(v) => onChange({ windows: Math.round(v) })} className="w-11" step={1} />
        </span>
        <label className="inline-flex items-center gap-1.5 cursor-pointer">
          <input
            type="checkbox"
            checked={room.openPlan}
            onChange={(e) => onChange({ openPlan: e.target.checked })}
            className="accent-amber-500"
          />
          open-plan
        </label>
        <span className="text-stone-400 ml-auto">
          {derived.floorArea} m² floor · {derived.wallArea} m² walls
          {room.sourcePage >= 0 && <span> · p{room.sourcePage + 1}</span>}
        </span>
      </div>
    </div>
  );
}

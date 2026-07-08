import { useState } from "react";
import { ChevronLeft, ClipboardList, Hammer, Info, ListChecks, TriangleAlert } from "lucide-react";
import { useStore } from "../store";
import { OPTION_GROUPS } from "../data/pricing";
import { GROUP_TASK, taskDone, undoCostForGroup } from "../lib/rework";
import {
  deriveRoom,
  roomConfidenceNote,
  roomLineItems,
  roomSubtotal,
} from "../lib/pricingEngine";
import type { Room, TaskStatus } from "../types";
import { gbp, FLOOR_LABEL } from "../lib/format";
import { ConfidenceBadge, NumInput, ProgressBar, SectionTitle } from "../components/ui";

type Tab = "pricing" | "details" | "tasks";

const TASK_CYCLE: TaskStatus[] = ["not_started", "in_progress", "complete", "approved"];
const TASK_STYLE: Record<TaskStatus, string> = {
  not_started: "bg-stone-100 text-stone-500 border-stone-200",
  in_progress: "bg-sky-50 text-sky-700 border-sky-200",
  complete: "bg-emerald-50 text-emerald-700 border-emerald-200",
  approved: "bg-emerald-500 text-white border-emerald-500",
};
const TASK_LABEL: Record<TaskStatus, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  complete: "Complete",
  approved: "Approved",
};

/** Right-hand panel shown in room focus mode: details, pricing, tasks. */
export default function RoomPricingPanel({ room }: { room: Room }) {
  const rates = useStore((s) => s.rates);
  const setSelection = useStore((s) => s.setSelection);
  const updateRoom = useStore((s) => s.updateRoom);
  const setTaskStatus = useStore((s) => s.setTaskStatus);
  const selectRoom = useStore((s) => s.selectRoom);
  const [tab, setTab] = useState<Tab>("pricing");

  const derived = deriveRoom(room);
  const items = roomLineItems(room, rates);
  const subtotal = roomSubtotal(room, rates);
  const done = room.tasks.filter((t) => t.status === "complete" || t.status === "approved").length;

  return (
    <div className="w-[380px] shrink-0 h-full bg-white border-l border-stone-200 flex flex-col overflow-hidden">
      {/* header */}
      <div className="px-4 pt-4 pb-3 border-b border-stone-200">
        <button
          onClick={() => selectRoom(null)}
          className="inline-flex items-center gap-1 text-xs text-stone-400 hover:text-stone-600 mb-2"
        >
          <ChevronLeft className="w-3.5 h-3.5" /> Whole house
        </button>
        <div className="flex items-center justify-between gap-2">
          <input
            value={room.name}
            onChange={(e) => updateRoom(room.id, { name: e.target.value })}
            className="font-semibold text-lg text-stone-800 border border-transparent hover:border-stone-300 focus:border-amber-400 rounded-md px-1 -mx-1 focus:outline-none bg-transparent min-w-0"
          />
          <ConfidenceBadge level={room.confidence} />
        </div>
        <p className="text-xs text-stone-500 mt-0.5">
          {FLOOR_LABEL[room.floor]} · {derived.floorArea} m² · {room.geometry.height} m ceiling
        </p>
        <div className="mt-3 flex items-end justify-between">
          <span className="text-[11px] uppercase tracking-wider text-stone-400 font-semibold">Room subtotal</span>
          <span className="text-2xl font-bold text-stone-900 tabular-nums">{gbp(subtotal)}</span>
        </div>
        <ProgressBar value={done / room.tasks.length} className="mt-2" />
      </div>

      {/* tabs */}
      <div className="flex border-b border-stone-200 text-xs font-medium">
        {(
          [
            ["pricing", "Pricing", Hammer],
            ["details", "Details", Info],
            ["tasks", "Tasks", ListChecks],
          ] as const
        ).map(([id, label, Icon]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 border-b-2 transition-colors ${
              tab === id ? "border-amber-500 text-amber-700" : "border-transparent text-stone-400 hover:text-stone-600"
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {tab === "pricing" && <PricingTab room={room} />}
        {tab === "details" && <DetailsTab room={room} />}
        {tab === "tasks" && (
          <div className="p-4 space-y-2">
            {room.tasks.map((t) => (
              <button
                key={t.id}
                onClick={() =>
                  setTaskStatus(room.id, t.id, TASK_CYCLE[(TASK_CYCLE.indexOf(t.status) + 1) % TASK_CYCLE.length])
                }
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg border text-sm transition-colors ${TASK_STYLE[t.status]}`}
              >
                <span className="font-medium">{t.name}</span>
                <span className="text-[10px] uppercase tracking-wide font-semibold">{TASK_LABEL[t.status]}</span>
              </button>
            ))}
            <p className="text-[11px] text-stone-400 pt-1">Click a task to cycle its status.</p>
          </div>
        )}
      </div>

      {/* itemised breakdown footer (pricing tab only) */}
      {tab === "pricing" && (
        <div className="border-t border-stone-200 bg-stone-50 max-h-56 overflow-y-auto">
          <div className="px-4 py-3">
            <SectionTitle>
              <span className="inline-flex items-center gap-1">
                <ClipboardList className="w-3 h-3" /> Itemised breakdown
              </span>
            </SectionTitle>
            {items.length === 0 && <p className="text-xs text-stone-400">No options selected yet.</p>}
            <table className="w-full text-xs">
              <tbody>
                {items.map((it, i) => (
                  <tr key={i} className="border-b border-stone-200/60 last:border-0">
                    <td className="py-1.5 text-stone-600">{it.label}</td>
                    <td className="py-1.5 text-right text-stone-400 whitespace-nowrap">
                      {it.qty} {it.unit} × £{it.rate}
                    </td>
                    <td className="py-1.5 pl-2 text-right font-medium text-stone-800 tabular-nums">{gbp(it.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-[10px] leading-relaxed text-stone-400">
              {roomConfidenceNote(room)} Assumes clear access, no asbestos, works in one visit. Excludes: structural
              works, building control fees, sanitaryware/kitchen unit supply unless stated.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

/** The option groups menu. */
function PricingTab({ room }: { room: Room }) {
  const rates = useStore((s) => s.rates);
  const setSelection = useStore((s) => s.setSelection);
  const baseline = useStore((s) => s.baseline);
  const derived = deriveRoom(room);

  return (
    <div className="p-4 space-y-5">
      {OPTION_GROUPS.map((group) => {
        const current = room.selections.filter((s) => s.groupId === group.id);
        // If the job that installs this group is already ticked complete,
        // warn up-front what changing the spec will cost in rework.
        const task = GROUP_TASK[group.id];
        const done = task ? taskDone(room, task) : false;
        const undoCost = done ? undoCostForGroup(room, group.id, baseline, rates) : 0;
        return (
          <div key={group.id}>
            <SectionTitle>{group.label}</SectionTitle>
            {done && undoCost > 0 && (
              <div className="mb-1.5 flex items-start gap-1.5 rounded-md bg-rose-50 border border-rose-200 px-2 py-1.5 text-[10px] leading-snug text-rose-700">
                <TriangleAlert className="w-3 h-3 shrink-0 mt-0.5" />
                <span>
                  "{task}" is ticked complete — changing this spec adds ~{gbp(undoCost)} rework to undo the finished
                  work.
                </span>
              </div>
            )}
            <div className="space-y-1.5">
              {!group.multi && (
                <OptionButton
                  label="None"
                  active={current.length === 0}
                  price={null}
                  onClick={() => setSelection(room.id, group.id, null)}
                />
              )}
              {group.options.map((opt) => {
                const sel = current.find((s) => s.optionId === opt.id);
                const isCount = opt.components.some((c) => c.qty === "count");
                const qty = sel?.quantityOverride ?? opt.defaultCount?.(derived);
                // preview price for unselected options so choices are comparable
                const preview = opt.components.reduce((sum, c) => {
                  const rate = rates.find((r) => r.id === c.rateId)?.rate ?? 0;
                  const q =
                    c.qty === "floorArea" ? derived.floorArea :
                    c.qty === "wallArea" ? derived.wallArea :
                    c.qty === "ceilingArea" ? derived.ceilingArea :
                    c.qty === "perimeter" ? derived.perimeter :
                    qty ?? 1;
                  return sum + q * rate;
                }, 0);
                return (
                  <OptionButton
                    key={opt.id}
                    label={opt.label}
                    sub={opt.assumption}
                    active={!!sel}
                    price={Math.round(preview)}
                    onClick={() => setSelection(room.id, group.id, opt.id)}
                    trailing={
                      sel && isCount ? (
                        <span onClick={(e) => e.stopPropagation()}>
                          <NumInput
                            value={qty ?? 1}
                            step={1}
                            onChange={(v) => setSelection(room.id, group.id, opt.id, Math.max(0, Math.round(v)))}
                            className="w-14"
                          />
                        </span>
                      ) : undefined
                    }
                  />
                );
              })}
            </div>
            {group.exclusion && <p className="mt-1.5 text-[10px] text-stone-400">{group.exclusion}</p>}
          </div>
        );
      })}
    </div>
  );
}

function OptionButton({
  label,
  sub,
  price,
  active,
  onClick,
  trailing,
}: {
  label: string;
  sub?: string;
  price: number | null;
  active: boolean;
  onClick: () => void;
  trailing?: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg border text-left transition-colors ${
        active
          ? "border-amber-400 bg-amber-50 text-stone-900"
          : "border-stone-200 bg-white text-stone-600 hover:border-stone-300"
      }`}
    >
      <span
        className={`w-3.5 h-3.5 rounded-full border-2 shrink-0 ${
          active ? "border-amber-500 bg-amber-500" : "border-stone-300"
        }`}
      />
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-medium truncate">{label}</span>
        {sub && <span className="block text-[10px] text-stone-400 truncate">{sub}</span>}
      </span>
      {trailing}
      {price != null && (
        <span className={`text-xs tabular-nums ${active ? "font-semibold text-amber-700" : "text-stone-400"}`}>
          {gbp(price)}
        </span>
      )}
    </button>
  );
}

/** Editable geometry + notes. */
function DetailsTab({ room }: { room: Room }) {
  const updateRoom = useStore((s) => s.updateRoom);
  const derived = deriveRoom(room);
  const g = room.geometry;

  return (
    <div className="p-4 space-y-5">
      <div>
        <SectionTitle>Dimensions</SectionTitle>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <label className="text-xs text-stone-500">
            Width (m)
            <NumInput value={g.width} onChange={(v) => updateRoom(room.id, { geometry: { ...g, width: v } })} className="w-full mt-1" />
          </label>
          <label className="text-xs text-stone-500">
            Depth (m)
            <NumInput value={g.depth} onChange={(v) => updateRoom(room.id, { geometry: { ...g, depth: v } })} className="w-full mt-1" />
          </label>
          <label className="text-xs text-stone-500">
            Ceiling height (m)
            <NumInput value={g.height} step={0.05} onChange={(v) => updateRoom(room.id, { geometry: { ...g, height: v } })} className="w-full mt-1" />
          </label>
          <label className="text-xs text-stone-500">
            Floor level
            <select
              value={room.floor}
              onChange={(e) => updateRoom(room.id, { floor: e.target.value as Room["floor"] })}
              className="w-full mt-1 border border-stone-300 rounded-md px-1.5 py-1 text-sm bg-white"
            >
              <option value="ground">Ground</option>
              <option value="first">First</option>
              <option value="second">Second</option>
            </select>
          </label>
          <label className="text-xs text-stone-500">
            Doors
            <NumInput value={room.doors} step={1} onChange={(v) => updateRoom(room.id, { doors: Math.round(v) })} className="w-full mt-1" />
          </label>
          <label className="text-xs text-stone-500">
            Windows
            <NumInput value={room.windows} step={1} onChange={(v) => updateRoom(room.id, { windows: Math.round(v) })} className="w-full mt-1" />
          </label>
        </div>
      </div>
      <div>
        <SectionTitle>Measured quantities</SectionTitle>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <Stat label="Floor area" value={`${derived.floorArea} m²`} />
          <Stat label="Ceiling area" value={`${derived.ceilingArea} m²`} />
          <Stat label="Wall area (net)" value={`${derived.wallArea} m²`} />
          <Stat label="Perimeter" value={`${derived.perimeter} m`} />
        </div>
        <p className="mt-2 text-[10px] text-stone-400">
          Wall area nets off {room.doors} door{room.doors === 1 ? "" : "s"} and {room.windows} window
          {room.windows === 1 ? "" : "s"}.
        </p>
      </div>
      <div>
        <SectionTitle>Notes</SectionTitle>
        <textarea
          value={room.notes}
          onChange={(e) => updateRoom(room.id, { notes: e.target.value })}
          rows={4}
          placeholder="Site notes, access constraints, client wishes…"
          className="w-full text-sm border border-stone-300 rounded-lg px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
        />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-stone-50 border border-stone-200 px-2.5 py-2">
      <div className="text-[10px] uppercase tracking-wide text-stone-400 font-semibold">{label}</div>
      <div className="text-sm font-semibold text-stone-800 tabular-nums">{value}</div>
    </div>
  );
}

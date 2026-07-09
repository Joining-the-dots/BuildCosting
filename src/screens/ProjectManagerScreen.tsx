import { useMemo } from "react";
import { Check, ClipboardCheck, RotateCcw, TriangleAlert, X } from "lucide-react";
import { useStore } from "../store";
import { reworkAmount } from "../lib/rework";
import { roomSubtotal } from "../lib/pricingEngine";
import { gbp, FLOOR_LABEL, timeAgo } from "../lib/format";
import { Card, ProgressBar, SectionTitle } from "../components/ui";
import type { ReworkCharge, Room, TaskStatus } from "../types";

/**
 * Project Manager — the on-site view. Every room's jobs as a tickable
 * checklist, plus the rework charges raised when someone changes a spec or
 * moves a serviced fitting AFTER the relevant job was ticked complete.
 */
export default function ProjectManagerScreen() {
  const rooms = useStore((s) => s.rooms);
  const rates = useStore((s) => s.rates);
  const baseline = useStore((s) => s.baseline);
  const reworkCharges = useStore((s) => s.reworkCharges);
  const setTaskStatus = useStore((s) => s.setTaskStatus);
  const setScreen = useStore((s) => s.setScreen);

  const allTasks = rooms.flatMap((r) => r.tasks);
  const doneCount = allTasks.filter((t) => t.status === "complete" || t.status === "approved").length;
  const progress = allTasks.length ? doneCount / allTasks.length : 0;

  const liveCharges = reworkCharges.filter((c) => c.status !== "waived");
  const reworkSum = useMemo(
    () => liveCharges.reduce((s, c) => s + reworkAmount(c, rooms, baseline, rates), 0),
    [liveCharges, rooms, baseline, rates],
  );

  if (rooms.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 text-stone-500">
        <ClipboardCheck className="w-10 h-10 text-stone-300" />
        <p className="text-sm">No project yet — upload a plan and confirm the rooms first.</p>
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
    <div className="h-full overflow-y-auto">
      <div className="max-w-5xl mx-auto p-4 sm:p-8">
        <div className="flex items-end justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-stone-900">Project manager</h1>
            <p className="text-sm text-stone-500 mt-1">
              Tick jobs off as they're done. Changes that undo a completed job raise a rework charge below.
            </p>
          </div>
          <div className="text-right">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-stone-400">Project progress</p>
            <p className="text-2xl font-bold text-stone-900 tabular-nums">{Math.round(progress * 100)}%</p>
            <ProgressBar value={progress} className="w-40 mt-1" />
          </div>
        </div>

        {/* rework charges */}
        {reworkCharges.length > 0 && (
          <Card className="mt-6 p-5 border-rose-200">
            <div className="flex items-center justify-between">
              <SectionTitle>
                <span className="inline-flex items-center gap-1.5 text-rose-500">
                  <TriangleAlert className="w-3.5 h-3.5" /> Rework charges
                </span>
              </SectionTitle>
              <span className="text-sm font-bold text-rose-600 tabular-nums">{gbp(reworkSum)} added to project</span>
            </div>
            <div className="space-y-2 mt-1">
              {reworkCharges.map((c) => (
                <ReworkRow key={c.id} charge={c} />
              ))}
            </div>
          </Card>
        )}

        {/* rooms with job checklists */}
        <div className="grid md:grid-cols-2 gap-5 mt-6">
          {(["ground", "first", "second"] as const)
            .flatMap((f) => rooms.filter((r) => r.floor === f))
            .map((room) => (
              <RoomChecklist key={room.id} room={room} onTask={setTaskStatus} subtotal={roomSubtotal(room, rates)} />
            ))}
        </div>
      </div>
    </div>
  );
}

function RoomChecklist({
  room,
  subtotal,
  onTask,
}: {
  room: Room;
  subtotal: number;
  onTask: (roomId: string, taskId: string, status: TaskStatus) => void;
}) {
  const done = room.tasks.filter((t) => t.status === "complete" || t.status === "approved").length;
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-semibold text-stone-800 truncate">{room.name}</h3>
          <p className="text-[11px] text-stone-400">
            {FLOOR_LABEL[room.floor]} · {gbp(subtotal)}
          </p>
        </div>
        <span className="text-xs text-stone-500 tabular-nums shrink-0">
          {done}/{room.tasks.length}
        </span>
      </div>
      <ProgressBar value={done / room.tasks.length} className="mt-2" />
      <div className="mt-3 space-y-1">
        {room.tasks.map((t) => {
          const isDone = t.status === "complete" || t.status === "approved";
          return (
            <label
              key={t.id}
              className={`flex items-center gap-2.5 px-2 py-1.5 rounded-md cursor-pointer transition-colors ${
                isDone ? "bg-emerald-50" : "hover:bg-stone-50"
              }`}
            >
              <input
                type="checkbox"
                checked={isDone}
                onChange={() => onTask(room.id, t.id, isDone ? "not_started" : "complete")}
                className="accent-emerald-600 w-4 h-4"
              />
              <span className={`text-sm ${isDone ? "text-emerald-800 line-through decoration-emerald-300" : "text-stone-700"}`}>
                {t.name}
              </span>
              {t.status === "approved" && (
                <span className="ml-auto text-[9px] font-bold uppercase tracking-wide text-emerald-600">approved</span>
              )}
            </label>
          );
        })}
      </div>
    </Card>
  );
}

function ReworkRow({ charge }: { charge: ReworkCharge }) {
  const rooms = useStore((s) => s.rooms);
  const baseline = useStore((s) => s.baseline);
  const rates = useStore((s) => s.rates);
  const setReworkStatus = useStore((s) => s.setReworkStatus);
  const revertFurnitureMove = useStore((s) => s.revertFurnitureMove);
  const amount = reworkAmount({ ...charge, status: "pending" }, rooms, baseline, rates);
  const waived = charge.status === "waived";

  return (
    <div className={`rounded-lg border p-3 flex items-start gap-3 flex-wrap ${waived ? "border-stone-200 opacity-60" : "border-rose-200 bg-rose-50/40"}`}>
      <div className="flex-1 min-w-[220px]">
        <div className="text-sm font-medium text-stone-800">
          {charge.roomName} — {charge.reason}
        </div>
        <div className="text-[11px] text-stone-400 mt-0.5">
          Undoes "{charge.taskName}" · {timeAgo(charge.createdAt)} ·{" "}
          <span className={`font-semibold uppercase ${charge.status === "accepted" ? "text-emerald-600" : waived ? "text-stone-400" : "text-rose-500"}`}>
            {charge.status}
          </span>
        </div>
      </div>
      <span className={`text-lg font-bold tabular-nums ${waived ? "text-stone-400 line-through" : "text-rose-600"}`}>
        +{gbp(amount)}
      </span>
      <div className="flex items-center gap-1.5">
        {charge.status === "pending" && (
          <>
            <button
              onClick={() => setReworkStatus(charge.id, "accepted")}
              className="inline-flex items-center gap-1 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1.5 rounded-lg"
            >
              <Check className="w-3 h-3" /> Accept
            </button>
            <button
              onClick={() => setReworkStatus(charge.id, "waived")}
              className="inline-flex items-center gap-1 text-xs font-semibold bg-white border border-stone-300 hover:border-stone-400 text-stone-600 px-2.5 py-1.5 rounded-lg"
            >
              <X className="w-3 h-3" /> Waive
            </button>
            {charge.source === "furniture-move" && (
              <button
                onClick={() => revertFurnitureMove(charge.id)}
                title="Move the fitting back to where it was — no charge"
                className="inline-flex items-center gap-1 text-xs font-semibold bg-white border border-stone-300 hover:border-sky-400 hover:text-sky-600 text-stone-600 px-2.5 py-1.5 rounded-lg"
              >
                <RotateCcw className="w-3 h-3" /> Undo move
              </button>
            )}
          </>
        )}
        {charge.status === "waived" && (
          <button onClick={() => setReworkStatus(charge.id, "pending")} className="text-xs text-stone-400 hover:text-stone-600">
            reinstate
          </button>
        )}
      </div>
    </div>
  );
}

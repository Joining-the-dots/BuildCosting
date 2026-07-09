import { ArrowRight, Check, Clock, Send, X } from "lucide-react";
import { useStore } from "../store";
import { gbpSigned, timeAgo } from "../lib/format";
import { Card } from "../components/ui";
import type { Variation, VariationStatus } from "../types";

const STATUS_STYLE: Record<VariationStatus, string> = {
  draft: "bg-stone-100 text-stone-600",
  sent: "bg-sky-100 text-sky-700",
  approved: "bg-emerald-100 text-emerald-700",
  rejected: "bg-rose-100 text-rose-600",
};

/**
 * Variations / change orders. A card is created automatically whenever a room
 * option is changed away from the approved baseline; approving folds the
 * change into the baseline, rejecting reverts the room.
 */
export default function VariationsScreen() {
  const variations = useStore((s) => s.variations);
  const setVariationStatus = useStore((s) => s.setVariationStatus);
  const selectRoom = useStore((s) => s.selectRoom);
  const setScreen = useStore((s) => s.setScreen);

  const open = variations.filter((v) => v.status === "draft" || v.status === "sent");
  const closed = variations.filter((v) => v.status === "approved" || v.status === "rejected");
  const approvedSum = variations.filter((v) => v.status === "approved").reduce((s, v) => s + v.delta, 0);
  const pendingSum = open.reduce((s, v) => s + v.delta, 0);

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-4xl mx-auto p-4 sm:p-8">
        <h1 className="text-2xl font-bold text-stone-900">Variations</h1>
        <p className="text-sm text-stone-500 mt-1">
          Changing a priced option in any room creates a variation against the approved baseline.
        </p>

        <div className="flex gap-6 mt-4 text-sm">
          <span className="text-stone-500">
            Pending impact <b className="text-stone-800 tabular-nums">{gbpSigned(pendingSum)}</b>
          </span>
          <span className="text-stone-500">
            Approved impact <b className="text-emerald-700 tabular-nums">{gbpSigned(approvedSum)}</b>
          </span>
        </div>

        {variations.length === 0 && (
          <Card className="mt-6 p-10 text-center text-sm text-stone-400">
            No variations yet. Open the 3D model, pick a room and change an option — the difference will appear
            here as a draft change order.
          </Card>
        )}

        <div className="space-y-3 mt-6">
          {[...open, ...closed].map((v) => (
            <VariationCard
              key={v.id}
              v={v}
              onStatus={(s) => setVariationStatus(v.id, s)}
              onOpenRoom={() => {
                selectRoom(v.roomId);
                setScreen("model");
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function VariationCard({
  v,
  onStatus,
  onOpenRoom,
}: {
  v: Variation;
  onStatus: (s: VariationStatus) => void;
  onOpenRoom: () => void;
}) {
  const live = v.status === "draft" || v.status === "sent";
  return (
    <Card className={`p-4 ${live ? "" : "opacity-70"}`}>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={onOpenRoom} className="font-semibold text-sm text-stone-800 hover:text-amber-700">
              {v.roomName}
            </button>
            <span className="text-xs text-stone-400">· {v.groupLabel}</span>
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide ${STATUS_STYLE[v.status]}`}>
              {v.status}
            </span>
          </div>
          <div className="mt-1.5 text-sm text-stone-600 flex items-center gap-2 flex-wrap">
            <span className="line-through decoration-stone-300 text-stone-400">{v.fromLabel}</span>
            <ArrowRight className="w-3.5 h-3.5 text-stone-300 shrink-0" />
            <span className="font-medium">{v.toLabel}</span>
          </div>
          <div className="mt-1 text-[11px] text-stone-400 flex items-center gap-3">
            <span className="inline-flex items-center gap-1">
              <Clock className="w-3 h-3" /> {v.timeNote}
            </span>
            <span>{timeAgo(v.createdAt)}</span>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className={`text-lg font-bold tabular-nums ${v.delta >= 0 ? "text-stone-900" : "text-emerald-700"}`}>
            {gbpSigned(v.delta)}
          </span>
          {v.status === "draft" && (
            <button
              onClick={() => onStatus("sent")}
              className="inline-flex items-center gap-1 text-xs font-semibold bg-sky-600 hover:bg-sky-700 text-white px-2.5 py-1.5 rounded-lg"
            >
              <Send className="w-3 h-3" /> Send
            </button>
          )}
          {live && (
            <>
              <button
                onClick={() => onStatus("approved")}
                className="inline-flex items-center gap-1 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1.5 rounded-lg"
              >
                <Check className="w-3 h-3" /> Approve
              </button>
              <button
                onClick={() => onStatus("rejected")}
                title="Reject and revert the room to the baseline spec"
                className="inline-flex items-center gap-1 text-xs font-semibold bg-white border border-stone-300 hover:border-rose-400 hover:text-rose-600 text-stone-600 px-2.5 py-1.5 rounded-lg"
              >
                <X className="w-3 h-3" /> Reject
              </button>
            </>
          )}
        </div>
      </div>
    </Card>
  );
}

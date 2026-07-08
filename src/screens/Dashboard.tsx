import { useMemo } from "react";
import { ArrowRight, Building2, FileText, GitPullRequestArrow, TrendingUp } from "lucide-react";
import { useStore } from "../store";
import { projectTotals, roomSubtotal, deriveRoom } from "../lib/pricingEngine";
import { gbp, gbpSigned, timeAgo, FLOOR_LABEL } from "../lib/format";
import { Card, ProgressBar, SectionTitle } from "../components/ui";

export default function Dashboard() {
  const projectName = useStore((s) => s.projectName);
  const setProjectName = useStore((s) => s.setProjectName);
  const plan = useStore((s) => s.plan);
  const rooms = useStore((s) => s.rooms);
  const rates = useStore((s) => s.rates);
  const variations = useStore((s) => s.variations);
  const changes = useStore((s) => s.changes);
  const setScreen = useStore((s) => s.setScreen);
  const selectRoom = useStore((s) => s.selectRoom);
  const structuralWorks = useStore((s) => s.structuralWorks);

  const totals = useMemo(() => projectTotals(rooms, rates, structuralWorks), [rooms, rates, structuralWorks]);
  const approved = variations.filter((v) => v.status === "approved");
  const pending = variations.filter((v) => v.status === "draft" || v.status === "sent");
  const approvedSum = approved.reduce((s, v) => s + v.delta, 0);

  const taskStats = rooms.flatMap((r) => r.tasks);
  const progress = taskStats.length
    ? taskStats.filter((t) => t.status === "complete" || t.status === "approved").length / taskStats.length
    : 0;

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-6xl mx-auto p-8">
        <div className="flex items-end justify-between flex-wrap gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-stone-400">Project</p>
            <input
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              className="text-2xl font-bold text-stone-900 bg-transparent border border-transparent hover:border-stone-300 focus:border-amber-400 rounded-lg px-1 -mx-1 focus:outline-none"
            />
            <p className="text-sm text-stone-500 mt-1">
              {plan ? (
                <>
                  <FileText className="w-3.5 h-3.5 inline mr-1 -mt-0.5 text-emerald-500" />
                  {plan.fileName} · {plan.numPages} pages{plan.scaleNote && ` · ${plan.scaleNote}`}
                </>
              ) : (
                "No plan uploaded yet"
              )}
            </p>
          </div>
          <button
            onClick={() => setScreen(rooms.length ? "model" : "upload")}
            className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white font-semibold text-sm px-4 py-2.5 rounded-lg shadow-sm"
          >
            {rooms.length ? "Open 3D model" : "Upload a plan"}
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {/* stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
          <StatCard
            label="Current estimate"
            value={gbp(totals.total)}
            sub={`works ${gbp(totals.works)} · margin ${gbp(totals.margin)} · VAT ${gbp(totals.vat)}`}
            icon={<TrendingUp className="w-4 h-4 text-amber-500" />}
          />
          <StatCard
            label="Approved variations"
            value={gbpSigned(approvedSum)}
            sub={`${approved.length} approved · ${pending.length} pending`}
            icon={<GitPullRequestArrow className="w-4 h-4 text-sky-500" />}
          />
          <StatCard
            label="Progress"
            value={`${Math.round(progress * 100)}%`}
            sub={`${taskStats.filter((t) => t.status === "complete" || t.status === "approved").length}/${taskStats.length} tasks done`}
            icon={<Building2 className="w-4 h-4 text-emerald-500" />}
            bar={progress}
          />
          <StatCard
            label="Rooms"
            value={String(rooms.length)}
            sub={`${rooms.filter((r) => r.floor === "ground").length} ground · ${rooms.filter((r) => r.floor === "first").length} first`}
            icon={<Building2 className="w-4 h-4 text-stone-400" />}
          />
        </div>

        <div className="grid lg:grid-cols-3 gap-6 mt-6">
          {/* room table */}
          <Card className="lg:col-span-2 p-5">
            <SectionTitle>Room estimates</SectionTitle>
            {rooms.length === 0 && (
              <p className="text-sm text-stone-400">Upload a plan and extract the rooms to see estimates.</p>
            )}
            <table className="w-full text-sm">
              <tbody>
                {rooms.map((room) => {
                  const done = room.tasks.filter((t) => t.status === "complete" || t.status === "approved").length;
                  return (
                    <tr
                      key={room.id}
                      className="border-b border-stone-100 last:border-0 hover:bg-stone-50 cursor-pointer"
                      onClick={() => {
                        selectRoom(room.id);
                        setScreen("model");
                      }}
                    >
                      <td className="py-2.5 font-medium text-stone-800">{room.name}</td>
                      <td className="py-2.5 text-xs text-stone-400">{FLOOR_LABEL[room.floor]}</td>
                      <td className="py-2.5 text-xs text-stone-400 tabular-nums">
                        {deriveRoom(room).floorArea} m²
                      </td>
                      <td className="py-2.5 w-28">
                        <ProgressBar value={done / room.tasks.length} />
                      </td>
                      <td className="py-2.5 text-right font-semibold text-stone-800 tabular-nums">
                        {gbp(roomSubtotal(room, rates))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>

          {/* recent changes */}
          <Card className="p-5">
            <SectionTitle>Recent changes</SectionTitle>
            {changes.length === 0 && <p className="text-sm text-stone-400">Nothing yet.</p>}
            <ul className="space-y-2.5">
              {changes.slice(0, 12).map((c, i) => (
                <li key={i} className="text-xs text-stone-600 flex gap-2">
                  <span className="text-stone-300 shrink-0 tabular-nums w-14">{timeAgo(c.at)}</span>
                  <span>{c.text}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  icon,
  bar,
}: {
  label: string;
  value: string;
  sub: string;
  icon: React.ReactNode;
  bar?: number;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-400">{label}</span>
        {icon}
      </div>
      <div className="mt-1.5 text-2xl font-bold text-stone-900 tabular-nums">{value}</div>
      {bar !== undefined && <ProgressBar value={bar} className="mt-2" />}
      <div className="mt-1 text-[11px] text-stone-400">{sub}</div>
    </Card>
  );
}

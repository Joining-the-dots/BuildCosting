import { Building2, ClipboardCheck, FileUp, GitPullRequestArrow, LayoutDashboard, PoundSterling, Rotate3d } from "lucide-react";
import { useStore } from "./store";
import type { Screen } from "./types";
import Dashboard from "./screens/Dashboard";
import UploadScreen from "./screens/UploadScreen";
import ConfirmRoomsScreen from "./screens/ConfirmRoomsScreen";
import ModelScreen from "./screens/ModelScreen";
import ProjectManagerScreen from "./screens/ProjectManagerScreen";
import RatesScreen from "./screens/RatesScreen";
import VariationsScreen from "./screens/VariationsScreen";
import { projectTotals } from "./lib/pricingEngine";
import { gbp } from "./lib/format";

const NAV: Array<{ id: Screen; label: string; short: string; icon: typeof LayoutDashboard }> = [
  { id: "dashboard", label: "Dashboard", short: "Home", icon: LayoutDashboard },
  { id: "upload", label: "Plan Upload", short: "Plan", icon: FileUp },
  { id: "model", label: "3D Model", short: "3D", icon: Rotate3d },
  { id: "pm", label: "Project Manager", short: "PM", icon: ClipboardCheck },
  { id: "rates", label: "Pricing Library", short: "Rates", icon: PoundSterling },
  { id: "variations", label: "Variations", short: "Changes", icon: GitPullRequestArrow },
];

export default function App() {
  const screen = useStore((s) => s.screen);
  const setScreen = useStore((s) => s.setScreen);
  const rooms = useStore((s) => s.rooms);
  const rates = useStore((s) => s.rates);
  const variations = useStore((s) => s.variations);
  const projectName = useStore((s) => s.projectName);
  const structuralWorks = useStore((s) => s.structuralWorks);
  const reworkCharges = useStore((s) => s.reworkCharges);
  const baseline = useStore((s) => s.baseline);

  const totals = projectTotals(rooms, rates, structuralWorks, reworkCharges, baseline);
  const pendingVars = variations.filter((v) => v.status === "draft" || v.status === "sent").length;
  const pendingRework = reworkCharges.filter((c) => c.status === "pending").length;

  return (
    <div className="h-full flex flex-col md:flex-row bg-stone-100 text-stone-900 antialiased">
      {/* mobile top bar */}
      <header className="md:hidden flex items-center justify-between gap-3 px-4 h-12 bg-stone-900 text-white shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-6 h-6 rounded-md bg-amber-500 flex items-center justify-center shrink-0">
            <Building2 className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="text-sm font-semibold truncate">{projectName}</span>
        </div>
        <span className="text-sm font-bold tabular-nums shrink-0">{gbp(totals.total)}</span>
      </header>

      {/* sidebar (desktop) */}
      <aside className="hidden md:flex w-52 shrink-0 bg-stone-900 text-stone-300 flex-col">
        <div className="px-4 py-5 border-b border-stone-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center">
              <Building2 className="w-4.5 h-4.5 text-white" />
            </div>
            <div>
              <div className="font-bold text-white text-sm leading-tight">ScopePrice</div>
              <div className="text-[10px] text-stone-500">3D renovation pricing</div>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-2 space-y-0.5">
          {NAV.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setScreen(id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                screen === id || (id === "upload" && screen === "confirm")
                  ? "bg-stone-800 text-white font-medium"
                  : "hover:bg-stone-800/60 hover:text-white"
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
              {id === "variations" && pendingVars > 0 && (
                <span className="ml-auto bg-amber-500 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5">
                  {pendingVars}
                </span>
              )}
              {id === "pm" && pendingRework > 0 && (
                <span className="ml-auto bg-rose-500 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5">
                  {pendingRework}
                </span>
              )}
            </button>
          ))}
        </nav>
        <div className="p-4 border-t border-stone-800">
          <div className="text-[10px] uppercase tracking-wider text-stone-500 font-semibold truncate">{projectName}</div>
          <div className="text-lg font-bold text-white tabular-nums">{gbp(totals.total)}</div>
          <div className="text-[10px] text-stone-500">live estimate incl. VAT</div>
        </div>
      </aside>

      {/* main */}
      <main className="flex-1 min-w-0 min-h-0 overflow-hidden">
        {screen === "dashboard" && <Dashboard />}
        {screen === "upload" && <UploadScreen />}
        {screen === "confirm" && <ConfirmRoomsScreen />}
        {screen === "model" && <ModelScreen />}
        {screen === "pm" && <ProjectManagerScreen />}
        {screen === "rates" && <RatesScreen />}
        {screen === "variations" && <VariationsScreen />}
      </main>

      {/* mobile bottom tab bar */}
      <nav className="md:hidden shrink-0 h-14 bg-stone-900 border-t border-stone-800 flex items-stretch" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        {NAV.map(({ id, short, icon: Icon }) => {
          const active = screen === id || (id === "upload" && screen === "confirm");
          const badge = id === "variations" ? pendingVars : id === "pm" ? pendingRework : 0;
          return (
            <button
              key={id}
              onClick={() => setScreen(id)}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 relative ${
                active ? "text-amber-400" : "text-stone-400"
              }`}
            >
              <Icon className="w-4.5 h-4.5" />
              <span className="text-[9px] font-medium">{short}</span>
              {badge > 0 && (
                <span className="absolute top-1.5 right-1/2 translate-x-4 bg-rose-500 text-white text-[8px] font-bold rounded-full min-w-[14px] px-1 text-center">
                  {badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
}

import { Building2, FileUp, GitPullRequestArrow, LayoutDashboard, PoundSterling, Rotate3d } from "lucide-react";
import { useStore } from "./store";
import type { Screen } from "./types";
import Dashboard from "./screens/Dashboard";
import UploadScreen from "./screens/UploadScreen";
import ConfirmRoomsScreen from "./screens/ConfirmRoomsScreen";
import ModelScreen from "./screens/ModelScreen";
import RatesScreen from "./screens/RatesScreen";
import VariationsScreen from "./screens/VariationsScreen";
import { projectTotals } from "./lib/pricingEngine";
import { gbp } from "./lib/format";

const NAV: Array<{ id: Screen; label: string; icon: typeof LayoutDashboard }> = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "upload", label: "Plan Upload", icon: FileUp },
  { id: "model", label: "3D Model", icon: Rotate3d },
  { id: "rates", label: "Pricing Library", icon: PoundSterling },
  { id: "variations", label: "Variations", icon: GitPullRequestArrow },
];

export default function App() {
  const screen = useStore((s) => s.screen);
  const setScreen = useStore((s) => s.setScreen);
  const rooms = useStore((s) => s.rooms);
  const rates = useStore((s) => s.rates);
  const variations = useStore((s) => s.variations);
  const projectName = useStore((s) => s.projectName);
  const structuralWorks = useStore((s) => s.structuralWorks);

  const totals = projectTotals(rooms, rates, structuralWorks);
  const pendingVars = variations.filter((v) => v.status === "draft" || v.status === "sent").length;

  return (
    <div className="h-full flex bg-stone-100 text-stone-900 antialiased">
      {/* sidebar */}
      <aside className="w-52 shrink-0 bg-stone-900 text-stone-300 flex flex-col">
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
      <main className="flex-1 min-w-0 h-full overflow-hidden">
        {screen === "dashboard" && <Dashboard />}
        {screen === "upload" && <UploadScreen />}
        {screen === "confirm" && <ConfirmRoomsScreen />}
        {screen === "model" && <ModelScreen />}
        {screen === "rates" && <RatesScreen />}
        {screen === "variations" && <VariationsScreen />}
      </main>
    </div>
  );
}

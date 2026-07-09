import { useMemo } from "react";
import { RotateCcw } from "lucide-react";
import { useStore } from "../store";
import { projectTotals } from "../lib/pricingEngine";
import { gbp } from "../lib/format";
import { Card, SectionTitle } from "../components/ui";

/**
 * Builder Pricing Library — edit unit rates; the whole project reprices live
 * because every estimate is computed from these rates at render time.
 */
export default function RatesScreen() {
  const rates = useStore((s) => s.rates);
  const setRate = useStore((s) => s.setRate);
  const resetRates = useStore((s) => s.resetRates);
  const rooms = useStore((s) => s.rooms);
  const structuralWorks = useStore((s) => s.structuralWorks);
  const reworkCharges = useStore((s) => s.reworkCharges);
  const baseline = useStore((s) => s.baseline);
  const totals = useMemo(
    () => projectTotals(rooms, rates, structuralWorks, reworkCharges, baseline),
    [rooms, rates, structuralWorks, reworkCharges, baseline],
  );

  const categories = [...new Set(rates.map((r) => r.category))];

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-4xl mx-auto p-4 sm:p-8">
        <div className="flex items-end justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-stone-900">Builder pricing library</h1>
            <p className="text-sm text-stone-500 mt-1">
              Every price in the project is computed from these rates — edits reprice the estimate instantly.
            </p>
          </div>
          <div className="text-right">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-stone-400">Live project total</p>
            <p className="text-2xl font-bold text-stone-900 tabular-nums">{gbp(totals.total)}</p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-5 mt-6">
          {categories.map((cat) => (
            <Card key={cat} className="p-5">
              <SectionTitle>{cat}</SectionTitle>
              <div className="space-y-2">
                {rates
                  .filter((r) => r.category === cat)
                  .map((r) => (
                    <div key={r.id} className="flex items-center justify-between gap-3">
                      <label htmlFor={`rate-${r.id}`} className="text-sm text-stone-700">
                        {r.label}
                      </label>
                      <span className="flex items-center gap-1.5 shrink-0">
                        {r.unit !== "%" && <span className="text-xs text-stone-400">£</span>}
                        <input
                          id={`rate-${r.id}`}
                          type="number"
                          value={r.rate}
                          min={0}
                          step={r.unit === "%" ? 1 : 5}
                          onChange={(e) => setRate(r.id, parseFloat(e.target.value) || 0)}
                          className="w-24 border border-stone-300 rounded-md px-2 py-1.5 text-sm text-right bg-white focus:outline-none focus:ring-2 focus:ring-amber-400 tabular-nums"
                        />
                        <span className="text-xs text-stone-400 w-10">{r.unit === "%" ? "%" : `/ ${r.unit}`}</span>
                      </span>
                    </div>
                  ))}
              </div>
            </Card>
          ))}
        </div>

        <button
          onClick={resetRates}
          className="mt-6 inline-flex items-center gap-1.5 text-xs text-stone-400 hover:text-rose-500"
        >
          <RotateCcw className="w-3.5 h-3.5" /> Reset all rates to defaults
        </button>
      </div>
    </div>
  );
}

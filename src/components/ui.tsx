import type { ReactNode } from "react";
import type { Confidence } from "../types";

/** Small shared UI atoms (badge, progress bar, section card). */

export function ConfidenceBadge({ level }: { level: Confidence }) {
  const styles: Record<Confidence, string> = {
    high: "bg-emerald-50 text-emerald-700 border-emerald-200",
    medium: "bg-amber-50 text-amber-700 border-amber-200",
    low: "bg-rose-50 text-rose-600 border-rose-200",
  };
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide border ${styles[level]}`}>
      {level}
    </span>
  );
}

export function ProgressBar({ value, className = "" }: { value: number; className?: string }) {
  return (
    <div className={`h-1.5 rounded-full bg-stone-200 overflow-hidden ${className}`}>
      <div
        className="h-full rounded-full bg-emerald-500 transition-all duration-500"
        style={{ width: `${Math.round(value * 100)}%` }}
      />
    </div>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`bg-white rounded-xl border border-stone-200 shadow-sm ${className}`}>{children}</div>;
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <h3 className="text-[11px] font-semibold uppercase tracking-wider text-stone-400 mb-2">{children}</h3>;
}

export function NumInput({
  value,
  onChange,
  step = 0.1,
  min = 0,
  className = "",
  suffix,
}: {
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  className?: string;
  suffix?: string;
}) {
  return (
    <span className="inline-flex items-center gap-1">
      <input
        type="number"
        value={value}
        step={step}
        min={min}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className={`border border-stone-300 rounded-md px-1.5 py-0.5 text-sm text-right bg-white focus:outline-none focus:ring-2 focus:ring-amber-400 ${className}`}
      />
      {suffix && <span className="text-xs text-stone-400">{suffix}</span>}
    </span>
  );
}

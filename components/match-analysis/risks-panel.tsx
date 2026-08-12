import type { MatchRisk } from "@/lib/match-analysis/types";

type RisksPanelProps = {
  risks: MatchRisk[];
};

const severityStyles = {
  low: "border-slate-600 text-slate-300",
  medium: "border-amber-500/40 text-amber-300",
  high: "border-red-500/40 text-red-400",
} as const;

const severityLabel = {
  low: "Bajo",
  medium: "Medio",
  high: "Alto",
} as const;

export function RisksPanel({ risks }: RisksPanelProps) {
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 backdrop-blur-sm">
      <h3 className="text-sm font-medium uppercase tracking-wider text-slate-400">
        Riesgos
      </h3>
      <ul className="mt-5 space-y-3">
        {risks.map((risk) => (
          <li
            key={risk.id}
            className="rounded-xl border border-slate-800 bg-slate-950/40 p-4"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-white">{risk.title}</span>
              <span
                className={`rounded-md border px-2 py-0.5 text-[11px] font-medium ${severityStyles[risk.severity]}`}
              >
                {severityLabel[risk.severity]}
              </span>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">
              {risk.detail}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

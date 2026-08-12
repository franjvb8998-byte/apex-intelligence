import type { ExplanationFactor } from "@/lib/intelligence/types/engine";

type KeyFactorsProps = {
  factors: ExplanationFactor[];
};

const directionStyles = {
  supports: {
    label: "A favor",
    className: "border-[#00D4AA]/30 bg-[#00D4AA]/10 text-[#00D4AA]",
  },
  against: {
    label: "En contra",
    className: "border-red-500/30 bg-red-500/10 text-red-400",
  },
  neutral: {
    label: "Neutral",
    className: "border-slate-600 bg-slate-800/60 text-slate-300",
  },
} as const;

export function KeyFactors({ factors }: KeyFactorsProps) {
  const sorted = [...factors].sort((a, b) => b.weight - a.weight);

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 backdrop-blur-sm">
      <h3 className="text-sm font-medium uppercase tracking-wider text-slate-400">
        Factores clave
      </h3>
      <ul className="mt-5 space-y-4">
        {sorted.map((factor) => {
          const tone = directionStyles[factor.direction];
          return (
            <li
              key={factor.key}
              className="rounded-xl border border-slate-800/80 bg-slate-950/30 p-4"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-white">{factor.label}</span>
                <span
                  className={`rounded-md border px-2 py-0.5 text-[11px] font-medium ${tone.className}`}
                >
                  {tone.label}
                </span>
                <span className="ml-auto font-mono text-xs tabular-nums text-slate-500">
                  peso {(factor.weight * 100).toFixed(0)}%
                </span>
              </div>
              {factor.detail && (
                <p className="mt-2 text-sm leading-relaxed text-slate-400">
                  {factor.detail}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

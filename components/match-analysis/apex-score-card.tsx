import type { ApexScoreBreakdown } from "@/lib/match-analysis/types";
import type { ConfidenceScore } from "@/lib/intelligence/types";

type ApexScoreCardProps = {
  apexScore: ApexScoreBreakdown;
  confidence: ConfidenceScore;
  predictedLabel: string;
};

const bandCopy = {
  low: "Baja",
  medium: "Media",
  high: "Alta",
} as const;

export function ApexScoreCard({
  apexScore,
  confidence,
  predictedLabel,
}: ApexScoreCardProps) {
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 backdrop-blur-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-medium uppercase tracking-wider text-slate-400">
            APEX Score
          </h3>
          <p className="mt-3 font-mono text-5xl font-bold tabular-nums text-[#00D4AA]">
            {apexScore.value}
          </p>
          <p className="mt-2 max-w-xs text-sm text-slate-400">
            {apexScore.label}
          </p>
        </div>
        <ConfidenceBadge confidence={confidence} />
      </div>

      <p className="mt-6 text-sm text-slate-300">
        Lectura principal:{" "}
        <span className="font-semibold text-white">{predictedLabel}</span>
      </p>

      <ul className="mt-5 space-y-3 border-t border-slate-800 pt-5">
        {apexScore.components.map((component) => (
          <li key={component.key}>
            <div className="mb-1 flex justify-between text-xs text-slate-400">
              <span>{component.label}</span>
              <span className="font-mono tabular-nums">{component.value}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full rounded-full bg-[#00D4AA]/70 transition-[width] duration-700 ease-out"
                style={{ width: `${component.value}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function ConfidenceBadge({
  confidence,
}: {
  confidence: ConfidenceScore;
}) {
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-950/50 px-4 py-3 text-right">
      <p className="text-xs uppercase tracking-wider text-slate-500">
        Confianza
      </p>
      <p className="mt-1 text-lg font-semibold text-white">
        {bandCopy[confidence.band]}
      </p>
      <p className="font-mono text-sm tabular-nums text-[#00D4AA]">
        {Math.round(confidence.value * 100)}%
      </p>
    </div>
  );
}

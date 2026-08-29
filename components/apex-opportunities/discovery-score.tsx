import { cx } from "@/components/design-system/utils";
import { formatScore } from "@/components/apex-opportunities/format";
import { discoveryPriority } from "@/lib/apex-opportunities/discovery";
import type { ApexOpportunity } from "@/lib/apex-opportunities/types";

const BLOCKS = 14;

const BAR_TONE: Record<ApexOpportunity["verdict"], string> = {
  elite_pick: "bg-emerald-400",
  strong_bet: "bg-sky-400",
  lean_bet: "bg-amber-400",
  pass: "bg-slate-400",
  avoid: "bg-red-500",
};

export function OpportunityScoreViz({ row }: { row: ApexOpportunity }) {
  const score = Math.min(100, Math.max(0, row.score));
  const filled = Math.round((score / 100) * BLOCKS);
  const priority = discoveryPriority(row);

  return (
    <div
      className="min-w-[8.5rem]"
      role="img"
      aria-label={`APEX Score ${formatScore(score)}, ${priority.shortLabel}`}
    >
      <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--apex-fg-subtle)]">
        APEX Score
      </p>
      <p className="mt-1 font-mono text-4xl tabular-nums leading-none text-[var(--apex-fg)] sm:text-5xl">
        {formatScore(score)}
      </p>
      <div className="mt-3 flex gap-0.5" aria-hidden>
        {Array.from({ length: BLOCKS }, (_, index) => (
          <span
            key={index}
            className={cx(
              "h-2 flex-1 rounded-[1px]",
              index < filled ? BAR_TONE[row.verdict] : "bg-slate-800",
            )}
          />
        ))}
      </div>
      <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--apex-accent)]">
        {priority.shortLabel}
      </p>
    </div>
  );
}

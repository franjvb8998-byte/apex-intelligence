import type { ApexTone } from "@/components/design-system/tokens";
import { cx } from "@/components/design-system/utils";

type RatingStatProps = {
  label: string;
  value: string;
  hint?: string;
  tone?: ApexTone;
};

const valueTone: Record<ApexTone, string> = {
  neutral: "text-[var(--apex-fg)]",
  accent: "text-[var(--apex-accent)]",
  success: "text-[var(--apex-accent)]",
  warning: "text-[var(--apex-warning)]",
  danger: "text-[var(--apex-danger)]",
  info: "text-[var(--apex-info)]",
};

/**
 * Compact KPI cell for the Match Rating board.
 */
export function RatingStat({
  label,
  value,
  hint,
  tone = "neutral",
}: RatingStatProps) {
  return (
    <div className="min-w-0 rounded-[var(--apex-radius-lg)] border border-[var(--apex-border)] bg-slate-950/40 px-3 py-3">
      <p className="text-[10px] font-medium uppercase tracking-[var(--apex-tracking-wider)] text-[var(--apex-fg-subtle)]">
        {label}
      </p>
      <p
        className={cx(
          "mt-1 truncate font-mono text-lg font-semibold tabular-nums sm:text-xl",
          valueTone[tone],
        )}
      >
        {value}
      </p>
      {hint ? (
        <p className="mt-0.5 truncate text-[11px] text-[var(--apex-fg-subtle)]">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

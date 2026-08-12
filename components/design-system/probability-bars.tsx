import { cx, clamp01, toPercent } from "@/components/design-system/utils";

export type ProbabilityBarItem = {
  id: string;
  label: string;
  /** Probability in [0, 1]. */
  value: number;
};

type ProbabilityBarsProps = {
  items: ProbabilityBarItem[];
  /** Highlight the maximum value. */
  emphasizeMax?: boolean;
  className?: string;
  "aria-label"?: string;
};

/**
 * Horizontal probability bars — domain-agnostic (any labeled [0,1] values).
 */
export function ProbabilityBars({
  items,
  emphasizeMax = true,
  className,
  "aria-label": ariaLabel = "Probabilidades",
}: ProbabilityBarsProps) {
  const max = Math.max(0, ...items.map((item) => item.value));

  return (
    <ul className={cx("space-y-4", className)} aria-label={ariaLabel}>
      {items.map((item) => {
        const value = clamp01(item.value);
        const isLead = emphasizeMax && value === max && max > 0;
        return (
          <li key={item.id}>
            <div className="mb-1.5 flex items-baseline justify-between gap-3">
              <span
                className={cx(
                  "text-sm font-medium",
                  isLead ? "text-[var(--apex-accent)]" : "text-slate-300",
                )}
              >
                {item.label}
              </span>
              <span
                className={cx(
                  "font-mono text-sm tabular-nums",
                  isLead
                    ? "text-[var(--apex-accent)]"
                    : "text-[var(--apex-fg-muted)]",
                )}
              >
                {toPercent(value)}
              </span>
            </div>
            <div
              className="h-2 overflow-hidden rounded-[var(--apex-radius-full)] bg-slate-800"
              role="meter"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(value * 100)}
              aria-label={item.label}
            >
              <div
                className={cx(
                  "h-full rounded-[var(--apex-radius-full)] transition-[width] duration-[var(--apex-duration-bar)] ease-[var(--apex-ease-out)]",
                  isLead ? "bg-[var(--apex-accent)]" : "bg-slate-500",
                )}
                style={{ width: `${Math.max(value * 100, 2)}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

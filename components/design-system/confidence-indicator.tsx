import type { ApexTone } from "@/components/design-system/tokens";
import { Badge } from "@/components/design-system/badge";
import { cx, clamp01 } from "@/components/design-system/utils";

export type ConfidenceBand = "low" | "medium" | "high";

type ConfidenceIndicatorProps = {
  /** Confidence in [0, 1]. */
  value: number;
  band?: ConfidenceBand;
  label?: string;
  layout?: "badge" | "panel";
  className?: string;
};

const bandTone: Record<ConfidenceBand, ApexTone> = {
  low: "danger",
  medium: "warning",
  high: "success",
};

const bandLabel: Record<ConfidenceBand, string> = {
  low: "Baja",
  medium: "Media",
  high: "Alta",
};

export function resolveConfidenceBand(value: number): ConfidenceBand {
  const v = clamp01(value);
  if (v >= 0.75) return "high";
  if (v >= 0.45) return "medium";
  return "low";
}

/**
 * Visualizes model/process confidence without implying certainty.
 */
export function ConfidenceIndicator({
  value,
  band,
  label = "Confianza",
  layout = "panel",
  className,
}: ConfidenceIndicatorProps) {
  const resolved = band ?? resolveConfidenceBand(value);
  const pct = Math.round(clamp01(value) * 100);

  if (layout === "badge") {
    return (
      <Badge
        tone={bandTone[resolved]}
        className={className}
        aria-label={`${label}: ${bandLabel[resolved]} (${pct}%)`}
      >
        {label}: {bandLabel[resolved]} · {pct}%
      </Badge>
    );
  }

  return (
    <div
      className={cx(
        "rounded-[var(--apex-radius-xl)] border border-[var(--apex-border-strong)] bg-slate-950/50 px-4 py-3",
        className,
      )}
      role="group"
      aria-label={`${label}: ${bandLabel[resolved]} (${pct}%)`}
    >
      <p className="text-xs uppercase tracking-[var(--apex-tracking-wider)] text-[var(--apex-fg-subtle)]">
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold text-white">
        {bandLabel[resolved]}
      </p>
      <p className="font-mono text-sm tabular-nums text-[var(--apex-accent)]">
        {pct}%
      </p>
      <div
        className="mt-3 h-1.5 overflow-hidden rounded-[var(--apex-radius-full)] bg-slate-800"
        role="meter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-label={label}
      >
        <div
          className="h-full rounded-[var(--apex-radius-full)] bg-[var(--apex-accent)] transition-[width] duration-[var(--apex-duration-bar)] ease-[var(--apex-ease-out)]"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

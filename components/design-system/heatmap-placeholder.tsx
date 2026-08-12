import { cx } from "@/components/design-system/utils";

type HeatmapPlaceholderProps = {
  rows?: number;
  cols?: number;
  title?: string;
  description?: string;
  className?: string;
};

/**
 * Non-interactive heatmap skeleton for future pitch/zone analytics.
 * No data binding — layout & a11y placeholder only.
 */
export function HeatmapPlaceholder({
  rows = 6,
  cols = 8,
  title = "Heatmap",
  description = "Placeholder visual — sin datos de zona todavía.",
  className,
}: HeatmapPlaceholderProps) {
  const cells = Array.from({ length: rows * cols }, (_, index) => index);
  // Deterministic faux intensities for visual demo (not real data).
  const intensity = (index: number) => {
    const x = (index % cols) / Math.max(cols - 1, 1);
    const y = Math.floor(index / cols) / Math.max(rows - 1, 1);
    return 0.15 + 0.7 * (1 - Math.hypot(x - 0.45, y - 0.4));
  };

  return (
    <div
      className={cx("space-y-3", className)}
      role="img"
      aria-label={`${title}. ${description}`}
    >
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-medium text-white">{title}</p>
        <p className="text-xs text-[var(--apex-fg-subtle)]">Próximamente</p>
      </div>
      <div
        className="grid gap-1 rounded-[var(--apex-radius-xl)] border border-dashed border-[var(--apex-border-strong)] bg-slate-950/40 p-3"
        style={{
          gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
        }}
      >
        {cells.map((index) => (
          <div
            key={index}
            className="aspect-square rounded-sm"
            style={{
              backgroundColor: `rgb(0 212 170 / ${intensity(index)})`,
            }}
            aria-hidden
          />
        ))}
      </div>
      <p className="text-xs text-[var(--apex-fg-subtle)]">{description}</p>
    </div>
  );
}

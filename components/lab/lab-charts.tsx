import { cx } from "@/components/design-system/utils";
import type { LabBar, LabPoint } from "@/lib/lab/types";
import type { CalibrationBin } from "@/lib/learning-engine/types/evaluation";

function chartBounds(values: number[]): { min: number; max: number } {
  const finite = values.filter((value) => Number.isFinite(value));
  if (finite.length === 0) return { min: 0, max: 1 };
  const min = Math.min(...finite, 0);
  const max = Math.max(...finite, 0);
  if (min === max) return { min: min - 1, max: max + 1 };
  const pad = (max - min) * 0.08;
  return { min: min - pad, max: max + pad };
}

export function LabSparkline({
  points,
  label,
}: {
  points: LabPoint[];
  label: string;
}) {
  if (points.length < 2) {
    return (
      <p className="text-sm text-[var(--apex-fg-muted)]">
        Not enough observations for a curve.
      </p>
    );
  }
  const values = points.map((point) => point.value);
  const { min, max } = chartBounds(values);
  const width = 360;
  const height = 110;
  const coords = points.map((point, index) => {
    const x = (index / (points.length - 1)) * width;
    const y = height - ((point.value - min) / (max - min)) * height;
    return { x, y };
  });
  const line = coords
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");
  const zeroY = height - ((0 - min) / (max - min)) * height;
  const last = coords[coords.length - 1]!;
  const first = coords[0]!;
  const area = `${line} L ${last.x} ${height} L ${first.x} ${height} Z`;

  return (
    <div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-28 w-full"
        role="img"
        aria-label={label}
      >
        <path d={area} fill="var(--apex-accent)" fillOpacity="0.1" />
        <line
          x1="0"
          x2={width}
          y1={zeroY}
          y2={zeroY}
          stroke="var(--apex-border)"
          strokeDasharray="3 3"
        />
        <path
          d={line}
          fill="none"
          stroke="var(--apex-accent)"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>
      <div className="mt-1 flex justify-between font-mono text-[10px] text-[var(--apex-fg-subtle)]">
        <span>{points[0]?.label}</span>
        <span>{points[points.length - 1]?.label}</span>
      </div>
    </div>
  );
}

export function LabBarList({ bars }: { bars: LabBar[] }) {
  if (bars.length === 0) {
    return (
      <p className="text-sm text-[var(--apex-fg-muted)]">No features published.</p>
    );
  }
  return (
    <ul className="space-y-2">
      {bars.map((bar) => (
        <li key={bar.key}>
          <div className="mb-1 flex items-baseline justify-between gap-2">
            <span className="truncate text-[12px] text-[var(--apex-fg)]">
              {bar.label}
            </span>
            <span
              className={cx(
                "shrink-0 font-mono text-[11px] tabular-nums text-[var(--apex-fg-subtle)]",
                !bar.available && "text-[var(--apex-fg-subtle)]",
                bar.tone === "warning" && "text-[var(--apex-warning)]",
                bar.tone === "danger" && "text-[var(--apex-danger)]",
              )}
            >
              {bar.valueLabel}
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
            <div
              className={cx(
                "h-full rounded-full",
                bar.tone === "warning" && "bg-[var(--apex-warning)]",
                bar.tone === "danger" && "bg-[var(--apex-danger)]",
                bar.tone === "info" && "bg-[var(--apex-info)]",
                (!bar.tone || bar.tone === "accent" || bar.tone === "success") &&
                  "bg-[var(--apex-accent)]",
                (!bar.available || bar.tone === "neutral") && "bg-slate-600",
              )}
              style={{
                width: `${Math.min(100, Math.max(bar.available ? 2 : 0, bar.weight * 100))}%`,
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function LabCalibrationChart({ bins }: { bins: CalibrationBin[] }) {
  const usable = bins.filter((bin) => bin.count > 0);
  if (usable.length === 0) {
    return (
      <p className="text-sm text-[var(--apex-fg-muted)]">
        No calibration bins with support.
      </p>
    );
  }
  return (
    <ul className="space-y-2" aria-label="Reliability diagram">
      {usable.map((bin) => {
        const predicted = Math.round(bin.predicted * 100);
        const observed = Math.round(bin.observed * 100);
        return (
          <li key={bin.predicted} className="grid grid-cols-[3rem_1fr_3rem] items-center gap-2">
            <span className="font-mono text-[10px] text-[var(--apex-fg-subtle)]">
              {predicted}%
            </span>
            <div className="relative h-2 rounded-full bg-slate-800">
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-[var(--apex-accent)]"
                style={{ width: `${Math.min(100, observed)}%` }}
              />
            </div>
            <span className="text-right font-mono text-[10px] tabular-nums text-[var(--apex-fg)]">
              {observed}%
            </span>
          </li>
        );
      })}
    </ul>
  );
}

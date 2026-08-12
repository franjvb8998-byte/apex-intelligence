import { cx, clamp01 } from "@/components/design-system/utils";

type ScoreGaugeProps = {
  /** Score typically 0–100 (or pass max). */
  value: number;
  max?: number;
  label?: string;
  caption?: string;
  size?: "md" | "lg";
  className?: string;
};

/**
 * Circular score gauge (SVG). Presentational — no scoring logic.
 */
export function ScoreGauge({
  value,
  max = 100,
  label = "Score",
  caption,
  size = "lg",
  className,
}: ScoreGaugeProps) {
  const safeMax = max > 0 ? max : 100;
  const ratio = clamp01(value / safeMax);
  const display = Math.round(Math.min(Math.max(value, 0), safeMax));

  const dim = size === "lg" ? 140 : 112;
  const stroke = size === "lg" ? 10 : 8;
  const radius = (dim - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - ratio);

  return (
    <div
      className={cx("flex flex-col items-center gap-3", className)}
      role="img"
      aria-label={`${label}: ${display} de ${safeMax}`}
    >
      <div className="relative" style={{ width: dim, height: dim }}>
        <svg width={dim} height={dim} viewBox={`0 0 ${dim} ${dim}`} aria-hidden>
          <circle
            cx={dim / 2}
            cy={dim / 2}
            r={radius}
            fill="none"
            stroke="rgb(30 41 59)"
            strokeWidth={stroke}
          />
          <circle
            cx={dim / 2}
            cy={dim / 2}
            r={radius}
            fill="none"
            stroke="var(--apex-accent)"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            transform={`rotate(-90 ${dim / 2} ${dim / 2})`}
            className="transition-[stroke-dashoffset] duration-[var(--apex-duration-bar)] ease-[var(--apex-ease-out)]"
          />
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-mono text-3xl font-bold tabular-nums text-[var(--apex-accent)] sm:text-4xl">
            {display}
          </span>
          <span className="text-[11px] uppercase tracking-[var(--apex-tracking-wider)] text-[var(--apex-fg-subtle)]">
            {label}
          </span>
        </div>
      </div>
      {caption && (
        <p className="max-w-[16rem] text-center text-sm text-[var(--apex-fg-muted)]">
          {caption}
        </p>
      )}
    </div>
  );
}

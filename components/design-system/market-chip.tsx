import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cx } from "@/components/design-system/utils";

type MarketChipProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  value: string;
  selected?: boolean;
  hint?: string;
  /** When false, renders as a non-interactive div (display-only). */
  interactive?: boolean;
  children?: ReactNode;
};

/**
 * Selectable market outcome chip (odds / probability display).
 * Presentational only — selection state is controlled by the parent.
 */
export function MarketChip({
  label,
  value,
  selected = false,
  hint,
  interactive = true,
  className,
  type = "button",
  ...props
}: MarketChipProps) {
  const classes = cx(
    "w-full rounded-[var(--apex-radius-xl)] border px-4 py-3 text-left transition-[border-color,background-color,transform] duration-[var(--apex-duration-normal)] ease-[var(--apex-ease-standard)]",
    selected
      ? "border-[var(--apex-accent-border)] bg-[var(--apex-accent-muted)]"
      : "border-[var(--apex-border)] bg-slate-950/40",
    interactive &&
      "apex-focusable hover:border-[var(--apex-accent-border)] active:scale-[0.99]",
    !interactive && "cursor-default",
    className,
  );

  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-[var(--apex-fg-muted)]">{label}</span>
        <span
          className={cx(
            "font-mono text-sm tabular-nums",
            selected ? "text-[var(--apex-accent)]" : "text-[var(--apex-fg-muted)]",
          )}
        >
          {value}
        </span>
      </div>
      {hint && (
        <p className="mt-1 text-xs text-[var(--apex-fg-subtle)]">{hint}</p>
      )}
    </>
  );

  if (!interactive) {
    return (
      <div className={classes} aria-current={selected || undefined}>
        {body}
      </div>
    );
  }

  return (
    <button
      type={type}
      className={classes}
      aria-pressed={selected}
      {...props}
    >
      {body}
    </button>
  );
}

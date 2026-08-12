import type { HTMLAttributes, ReactNode } from "react";
import type { ApexTone } from "@/components/design-system/tokens";
import { cx } from "@/components/design-system/utils";

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  children: ReactNode;
  tone?: ApexTone;
  size?: "sm" | "md";
};

const toneClass: Record<ApexTone, string> = {
  neutral: "border-[var(--apex-border-strong)] bg-slate-800/60 text-slate-300",
  accent:
    "border-[var(--apex-accent-border)] bg-[var(--apex-accent-muted)] text-[var(--apex-accent)]",
  success:
    "border-[var(--apex-accent-border)] bg-[var(--apex-accent-muted)] text-[var(--apex-accent)]",
  warning:
    "border-amber-500/40 bg-[var(--apex-warning-muted)] text-[var(--apex-warning)]",
  danger:
    "border-red-500/40 bg-[var(--apex-danger-muted)] text-[var(--apex-danger)]",
  info: "border-sky-500/40 bg-[var(--apex-info-muted)] text-[var(--apex-info)]",
};

/**
 * Compact status / meta label.
 */
export function Badge({
  children,
  tone = "neutral",
  size = "sm",
  className,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-[var(--apex-radius-sm)] border font-medium",
        size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs",
        toneClass[tone],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}

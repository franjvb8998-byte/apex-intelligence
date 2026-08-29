"use client";

import { useTranslations } from "next-intl";
import { cx } from "@/components/design-system/utils";

type ThinkingIndicatorProps = {
  className?: string;
  label?: string;
};

export function ThinkingIndicator({
  className,
  label,
}: ThinkingIndicatorProps) {
  const t = useTranslations("copilot");
  return (
    <div
      className={cx(
        "inline-flex items-center gap-3 rounded-[var(--apex-radius-xl)] border border-[var(--apex-border)] bg-[var(--apex-surface)] px-4 py-3",
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <span className="flex items-center gap-1.5" aria-hidden>
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--apex-accent)] [animation-delay:0ms]" />
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--apex-accent)] [animation-delay:150ms]" />
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--apex-accent)] [animation-delay:300ms]" />
      </span>
      <span className="text-xs text-[var(--apex-fg-muted)]">
        {label ?? t("thinkingDefault")}
      </span>
    </div>
  );
}

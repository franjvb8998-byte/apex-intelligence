import type { ReactNode } from "react";
import { Badge } from "@/components/design-system/badge";
import type { ApexTone } from "@/components/design-system/tokens";
import { cx } from "@/components/design-system/utils";

export type TimelineItem = {
  id: string;
  title: string;
  description?: string;
  /** Minute mark or time label, e.g. "12'" or "18:01". */
  timeLabel?: string;
  tone?: ApexTone;
  meta?: ReactNode;
};

type TimelineProps = {
  items: TimelineItem[];
  className?: string;
  "aria-label"?: string;
};

/**
 * Vertical chronological timeline. Parent owns ordering.
 */
export function Timeline({
  items,
  className,
  "aria-label": ariaLabel = "Cronología",
}: TimelineProps) {
  return (
    <ol className={cx("relative space-y-0", className)} aria-label={ariaLabel}>
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <li key={item.id} className="relative flex gap-4 pb-6 last:pb-0">
            <div className="flex w-10 shrink-0 flex-col items-center">
              <span
                className={cx(
                  "z-10 mt-1 h-3 w-3 rounded-full border-2 border-[var(--apex-bg)]",
                  item.tone === "danger"
                    ? "bg-[var(--apex-danger)]"
                    : item.tone === "warning"
                      ? "bg-[var(--apex-warning)]"
                      : "bg-[var(--apex-accent)]",
                )}
                aria-hidden
              />
              {!isLast && (
                <span
                  className="mt-1 w-px flex-1 bg-[var(--apex-border)]"
                  aria-hidden
                />
              )}
            </div>
            <div className="min-w-0 flex-1 rounded-[var(--apex-radius-xl)] border border-[var(--apex-border)] bg-slate-950/30 px-4 py-3">
              <div className="flex flex-wrap items-center gap-2">
                {item.timeLabel && (
                  <Badge tone="neutral">{item.timeLabel}</Badge>
                )}
                <p className="font-medium text-white">{item.title}</p>
                {item.meta}
              </div>
              {item.description && (
                <p className="mt-2 text-sm leading-relaxed text-[var(--apex-fg-muted)]">
                  {item.description}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

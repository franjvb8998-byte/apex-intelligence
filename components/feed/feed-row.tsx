"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/design-system";
import { cx } from "@/components/design-system/utils";
import { confidenceTone } from "@/lib/feed/build";
import type { FeedRow } from "@/lib/feed/types";
import { translateFeedOrRaw } from "@/lib/i18n/translate-feed";

export function FeedRowLink({ row }: { row: FeedRow }) {
  const t = useTranslations("feed");
  return (
    <Link
      href={row.href}
      className="apex-focusable group flex items-start gap-2 rounded-[var(--apex-radius-md)] border border-transparent px-1.5 py-1.5 transition-colors hover:border-[var(--apex-accent-border)] hover:bg-slate-950/50"
    >
      <span
        className={cx(
          "mt-1 h-8 w-0.5 shrink-0 rounded-full",
          row.badge?.tone === "success" && "bg-[var(--apex-accent)]",
          row.badge?.tone === "accent" && "bg-[var(--apex-accent)]",
          row.badge?.tone === "warning" && "bg-[var(--apex-warning)]",
          row.badge?.tone === "danger" && "bg-[var(--apex-danger)]",
          row.badge?.tone === "info" && "bg-[var(--apex-info)]",
          (!row.badge || row.badge.tone === "neutral") && "bg-slate-600",
        )}
      />
      <span className="min-w-0 flex-1">
        <span className="flex items-start justify-between gap-2">
          <span className="truncate text-[13px] font-medium text-[var(--apex-fg)] group-hover:text-white">
            {translateFeedOrRaw(t, row.title, row.i18n)}
          </span>
          {row.badge && (
            <Badge tone={row.badge.tone} className="shrink-0 font-mono">
              {translateFeedOrRaw(t, row.badge.label)}
            </Badge>
          )}
        </span>
        <span className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-[var(--apex-fg-muted)]">
          {translateFeedOrRaw(t, row.subtitle, row.i18n)}
        </span>
        <span className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 font-mono text-[10px] tabular-nums text-[var(--apex-fg-subtle)]">
          {row.kpis.map((kpi) => (
            <span
              key={kpi.label}
              className={cx(
                kpi.tone === "success" && "text-[var(--apex-accent)]",
                kpi.tone === "accent" && "text-[var(--apex-accent)]",
                kpi.tone === "warning" && "text-[var(--apex-warning)]",
                kpi.tone === "danger" && "text-[var(--apex-danger)]",
                kpi.tone === "info" && "text-[var(--apex-info)]",
              )}
            >
              {translateFeedOrRaw(t, kpi.label)} {kpi.value}
            </span>
          ))}
        </span>
        {row.confidence != null && (
          <span
            className="mt-1.5 block h-0.5 overflow-hidden rounded-full bg-slate-800"
            aria-hidden
          >
            <span
              className={cx(
                "block h-full rounded-full",
                confidenceTone(row.confidence) === "success" &&
                  "bg-[var(--apex-accent)]",
                confidenceTone(row.confidence) === "warning" &&
                  "bg-[var(--apex-warning)]",
                confidenceTone(row.confidence) === "danger" &&
                  "bg-[var(--apex-danger)]",
                confidenceTone(row.confidence) === "neutral" && "bg-slate-500",
              )}
              style={{ width: `${Math.min(100, Math.max(0, row.confidence))}%` }}
            />
          </span>
        )}
      </span>
    </Link>
  );
}

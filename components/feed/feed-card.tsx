"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/design-system";
import { cx } from "@/components/design-system/utils";
import type { FeedCardModel, FeedKpi } from "@/lib/feed/types";
import { translateFeedOrRaw } from "@/lib/i18n/translate-feed";

export type FeedCardStatus = "ready" | "loading" | "empty" | "error";

type FeedCardProps = {
  title: string;
  eyebrow?: string;
  icon?: ReactNode;
  badge?: ReactNode;
  model?: FeedCardModel;
  status?: FeedCardStatus;
  errorTitle?: string;
  errorDescription?: string;
  children?: ReactNode;
  className?: string;
};

function KpiStrip({ kpis }: { kpis: FeedKpi[] }) {
  const t = useTranslations("feed");
  return (
    <dl className="mb-3 grid grid-cols-3 gap-2">
      {kpis.map((kpi) => (
        <div
          key={kpi.label}
          className="rounded-[var(--apex-radius-md)] border border-[var(--apex-border)] bg-black/30 px-2 py-1.5"
        >
          <dt className="font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--apex-fg-subtle)]">
            {translateFeedOrRaw(t, kpi.label)}
          </dt>
          <dd
            className={cx(
              "mt-0.5 font-mono text-sm tabular-nums",
              kpi.tone === "success" && "text-[var(--apex-accent)]",
              kpi.tone === "accent" && "text-[var(--apex-accent)]",
              kpi.tone === "warning" && "text-[var(--apex-warning)]",
              kpi.tone === "danger" && "text-[var(--apex-danger)]",
              kpi.tone === "info" && "text-[var(--apex-info)]",
              (!kpi.tone || kpi.tone === "neutral") && "text-[var(--apex-fg)]",
            )}
          >
            {kpi.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function FeedCardSkeleton({
  title,
  className,
}: {
  title: string;
  className?: string;
}) {
  const t = useTranslations("feed");
  return (
    <section
      className={cx(
        "flex h-full min-h-[18rem] flex-col rounded-[var(--apex-radius-xl)] border border-[var(--apex-border)] bg-[var(--apex-surface)] p-4",
        className,
      )}
      aria-busy="true"
      aria-label={t("loadingAria", { title })}
    >
      <div className="mb-3 flex items-center gap-2">
        <span className="h-2 w-2 animate-pulse rounded-full bg-[var(--apex-accent)]" />
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--apex-fg-subtle)]">
          {title}
        </p>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[0, 1, 2].map((index) => (
          <div
            key={index}
            className="h-10 animate-pulse rounded-[var(--apex-radius-md)] bg-slate-900/80"
            style={{ animationDelay: `${index * 80}ms` }}
          />
        ))}
      </div>
      <div className="mt-3 space-y-2">
        {[0, 1, 2, 3].map((index) => (
          <div
            key={index}
            className="h-12 animate-pulse rounded-[var(--apex-radius-md)] bg-slate-900/70"
            style={{ animationDelay: `${index * 70}ms` }}
          />
        ))}
      </div>
    </section>
  );
}

export function FeedCard({
  title,
  eyebrow,
  icon,
  badge,
  model,
  status = "ready",
  errorTitle = "paneFailed",
  errorDescription = "paneFailedDescription",
  children,
  className,
}: FeedCardProps) {
  const t = useTranslations("feed");
  const common = useTranslations("common");

  if (status === "loading") {
    return <FeedCardSkeleton title={title} className={className} />;
  }

  return (
    <section
      className={cx(
        "flex h-full min-h-[18rem] flex-col rounded-[var(--apex-radius-xl)] border border-[var(--apex-border)] bg-[var(--apex-surface)] p-4 shadow-[var(--apex-shadow-sm)]",
        className,
      )}
    >
      <header className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--apex-accent)]">
            <span className="text-[var(--apex-accent)]">{icon}</span>
            {eyebrow ?? "APEX"}
          </p>
          <h2 className="mt-1 truncate text-sm font-semibold tracking-tight text-[var(--apex-fg)]">
            {title}
          </h2>
        </div>
        {badge}
      </header>

      {status === "error" ? (
        <div
          className="flex flex-1 flex-col items-start justify-center rounded-[var(--apex-radius-md)] border border-red-500/25 bg-[var(--apex-danger-muted)] px-3 py-6"
          role="alert"
        >
          <Badge tone="danger">{common("error")}</Badge>
          <p className="mt-2 text-sm font-medium text-[var(--apex-fg)]">
            {translateFeedOrRaw(t, errorTitle)}
          </p>
          <p className="mt-1 text-xs text-[var(--apex-fg-muted)]">
            {translateFeedOrRaw(t, errorDescription)}
          </p>
        </div>
      ) : status === "empty" || (model && model.rows.length === 0) ? (
        <div className="flex flex-1 flex-col items-start justify-center rounded-[var(--apex-radius-md)] border border-dashed border-[var(--apex-border-strong)] px-3 py-6">
          <p className="text-sm font-medium text-[var(--apex-fg)]">
            {translateFeedOrRaw(t, model?.emptyTitle ?? "emptyFallbackTitle")}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-[var(--apex-fg-muted)]">
            {model?.emptyDescription
              ? translateFeedOrRaw(t, model.emptyDescription)
              : null}
          </p>
          {model && (
            <Link
              href={model.footerHref}
              className="apex-focusable mt-3 text-xs text-[var(--apex-accent)] hover:text-[var(--apex-accent-hover)]"
            >
              {translateFeedOrRaw(t, model.footerLabel)}
            </Link>
          )}
        </div>
      ) : (
        <>
          {model && <KpiStrip kpis={model.kpis} />}
          <div className="min-h-0 flex-1 space-y-1">{children}</div>
          {model && (
            <Link
              href={model.footerHref}
              className="apex-focusable mt-3 inline-flex items-center justify-between border-t border-[var(--apex-border)] pt-2 font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--apex-fg-subtle)] hover:text-[var(--apex-accent)]"
            >
              {translateFeedOrRaw(t, model.footerLabel)}
              <span aria-hidden>↗</span>
            </Link>
          )}
        </>
      )}
    </section>
  );
}

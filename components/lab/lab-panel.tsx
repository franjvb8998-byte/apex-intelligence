import type { ReactNode } from "react";
import Link from "next/link";
import { Badge } from "@/components/design-system";
import { cx } from "@/components/design-system/utils";
import type { LabKpi } from "@/lib/lab/types";

export type LabPanelStatus = "ready" | "loading" | "empty" | "error";

export function LabKpiStrip({ kpis }: { kpis: LabKpi[] }) {
  if (kpis.length === 0) return null;
  return (
    <dl
      className={cx(
        "mb-4 grid gap-2",
        kpis.length >= 6
          ? "grid-cols-3 sm:grid-cols-6"
          : kpis.length === 5
            ? "grid-cols-2 sm:grid-cols-5"
            : "grid-cols-2 sm:grid-cols-4",
      )}
    >
      {kpis.map((kpi) => (
        <div
          key={kpi.label}
          className="rounded-[var(--apex-radius-md)] border border-[var(--apex-border)] bg-black/35 px-2.5 py-2"
        >
          <dt className="font-mono text-[9px] uppercase tracking-[0.16em] text-[var(--apex-fg-subtle)]">
            {kpi.label}
          </dt>
          <dd
            className={cx(
              "mt-0.5 font-mono text-sm tabular-nums text-[var(--apex-fg)]",
              kpi.tone === "success" && "text-[var(--apex-accent)]",
              kpi.tone === "accent" && "text-[var(--apex-accent)]",
              kpi.tone === "warning" && "text-[var(--apex-warning)]",
              kpi.tone === "danger" && "text-[var(--apex-danger)]",
              kpi.tone === "info" && "text-[var(--apex-info)]",
            )}
            title={kpi.hint}
          >
            {kpi.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

type LabPanelProps = {
  id?: string;
  title: string;
  eyebrow?: string;
  icon?: ReactNode;
  badge?: ReactNode;
  kpis?: LabKpi[];
  status?: LabPanelStatus;
  emptyTitle?: string;
  emptyDescription?: string;
  errorTitle?: string;
  errorDescription?: string;
  footerHref?: string;
  footerLabel?: string;
  children?: ReactNode;
  className?: string;
};

export function LabPanelSkeleton({
  title,
  className,
}: {
  title: string;
  className?: string;
}) {
  return (
    <section
      className={cx(
        "flex h-full min-h-[16rem] flex-col rounded-[var(--apex-radius-xl)] border border-[var(--apex-border)] bg-[var(--apex-surface)] p-4",
        className,
      )}
      aria-busy="true"
      aria-label={`Loading ${title}`}
    >
      <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--apex-fg-subtle)]">
        {title}
      </p>
      <div className="mt-4 grid grid-cols-4 gap-2">
        {[0, 1, 2, 3].map((index) => (
          <div
            key={index}
            className="h-12 animate-pulse rounded-[var(--apex-radius-md)] bg-slate-900/80"
            style={{ animationDelay: `${index * 70}ms` }}
          />
        ))}
      </div>
      <div className="mt-4 flex-1 animate-pulse rounded-[var(--apex-radius-md)] bg-slate-900/50" />
    </section>
  );
}

export function LabPanel({
  id,
  title,
  eyebrow,
  icon,
  badge,
  kpis = [],
  status = "ready",
  emptyTitle = "No observations",
  emptyDescription = "This pane has nothing to plot yet.",
  errorTitle = "Unavailable",
  errorDescription = "This research pane failed independently.",
  footerHref,
  footerLabel,
  children,
  className,
}: LabPanelProps) {
  return (
    <section
      id={id}
      className={cx(
        "flex h-full min-h-[16rem] scroll-mt-20 flex-col rounded-[var(--apex-radius-xl)] border border-[var(--apex-border)] bg-[var(--apex-surface)] p-4 sm:p-5",
        className,
      )}
    >
      <header className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--apex-accent)]">
            {icon}
            {eyebrow ?? "APEX Lab"}
          </p>
          <h3 className="mt-1 text-sm font-semibold tracking-tight text-[var(--apex-fg)]">
            {title}
          </h3>
        </div>
        {badge}
      </header>

      {status === "loading" ? (
        <LabPanelSkeleton title={title} className="min-h-0 border-0 bg-transparent p-0" />
      ) : status === "error" ? (
        <div role="alert" className="flex flex-1 flex-col justify-center">
          <Badge tone="danger">Error</Badge>
          <p className="mt-3 text-sm font-medium text-[var(--apex-fg)]">{errorTitle}</p>
          <p className="mt-1 text-sm text-[var(--apex-fg-muted)]">{errorDescription}</p>
        </div>
      ) : status === "empty" ? (
        <div className="flex flex-1 flex-col justify-center">
          <Badge>Empty</Badge>
          <p className="mt-3 text-sm font-medium text-[var(--apex-fg)]">{emptyTitle}</p>
          <p className="mt-1 text-sm text-[var(--apex-fg-muted)]">{emptyDescription}</p>
        </div>
      ) : (
        <>
          <LabKpiStrip kpis={kpis} />
          <div className="min-h-0 flex-1">{children}</div>
        </>
      )}

      {footerHref && footerLabel && (
        <Link
          href={footerHref}
          className="apex-focusable mt-4 inline-flex text-[11px] font-medium text-[var(--apex-accent)] hover:underline"
        >
          {footerLabel} →
        </Link>
      )}
    </section>
  );
}

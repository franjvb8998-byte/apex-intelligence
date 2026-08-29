"use client";

import { useTranslations } from "next-intl";
import { Card } from "@/components/design-system";
import type { ScannerDeskStatus } from "@/lib/opportunity-scanner/status";

export function ScannerStatus({ status }: { status: ScannerDeskStatus }) {
  const t = useTranslations("scanner.status");
  const quiet = status.analyzed === 0;

  return (
    <Card padding="md" aria-label={t("eyebrow")}>
      <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--apex-accent)]">
        {t("eyebrow")}
      </p>
      <p className="mt-1 text-sm text-[var(--apex-fg-muted)]">
        {quiet ? t("quietNote") : t("activeNote")}
      </p>
      <div className="mt-5 grid grid-cols-3 gap-3">
        <Metric label={t("fixturesAnalyzed")} value={status.analyzed} />
        <Metric label={t("qualified")} value={status.qualified} accent />
        <Metric label={t("rejected")} value={status.rejected} />
      </div>
      {status.mainReason ? (
        <div className="mt-5 space-y-1.5 border-t border-[var(--apex-border)] pt-4">
          <p className="text-sm text-[var(--apex-fg)]">
            <span className="text-[var(--apex-fg-subtle)]">{t("mainReason")} </span>
            {t(`reason.${status.mainReason}`)}
          </p>
          {status.secondaryReason ? (
            <p className="text-sm text-[var(--apex-fg-muted)]">
              <span className="text-[var(--apex-fg-subtle)]">{t("also")} </span>
              {t(`reason.${status.secondaryReason}`)}
            </p>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}

function Metric({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <div className="rounded-[var(--apex-radius-lg)] border border-[var(--apex-border)] bg-black/25 px-3 py-3">
      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--apex-fg-subtle)]">
        {label}
      </p>
      <p
        className={
          accent
            ? "mt-1.5 font-mono text-2xl tabular-nums text-[var(--apex-accent)]"
            : "mt-1.5 font-mono text-2xl tabular-nums text-[var(--apex-fg)]"
        }
      >
        {value}
      </p>
    </div>
  );
}

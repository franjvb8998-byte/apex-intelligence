"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Card } from "@/components/design-system";
import { scannerFilterEmptyCopy } from "@/lib/opportunity-scanner/copy";
import type { ScannerFilters } from "@/lib/opportunity-scanner/filters";
import type { ScannerMode } from "@/lib/opportunity-scanner/modes";
import type { ScannerStatusReason } from "@/lib/opportunity-scanner/status";

export function ScannerFilterEmpty({
  mode,
  filters,
  mainReason,
  secondaryReason,
  onTodaysBest,
}: {
  mode: ScannerMode;
  filters: ScannerFilters;
  mainReason: ScannerStatusReason | null;
  secondaryReason: ScannerStatusReason | null;
  onTodaysBest: () => void;
}) {
  const t = useTranslations("scanner.empty");
  const status = useTranslations("scanner.status");
  const copy = scannerFilterEmptyCopy(mode, filters);

  return (
    <Card padding="lg" aria-label={t("aria")}>
      <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--apex-accent)]">
        {t("deskQuiet")}
      </p>
      <h3 className="mt-2 text-lg font-semibold tracking-tight text-[var(--apex-fg)]">
        {t(copy.titleKey)}
      </h3>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--apex-fg-muted)]">
        {t(copy.descriptionKey)}
      </p>
      {mainReason ? (
        <div className="mt-4 space-y-1 text-sm">
          <p className="text-[var(--apex-fg)]">
            <span className="text-[var(--apex-fg-subtle)]">{status("mainReason")} </span>
            {status(`reason.${mainReason}`)}
          </p>
          {secondaryReason ? (
            <p className="text-[var(--apex-fg-muted)]">
              <span className="text-[var(--apex-fg-subtle)]">{status("also")} </span>
              {status(`reason.${secondaryReason}`)}
            </p>
          ) : null}
        </div>
      ) : null}
      <div className="mt-5 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onTodaysBest}
          className="apex-focusable rounded-[var(--apex-radius-md)] border border-[var(--apex-accent-border)] bg-[var(--apex-accent-muted)] px-3 py-2 text-xs font-medium text-[var(--apex-accent)]"
        >
          {t("todaysBest")}
        </button>
        <Link
          href="/match-center"
          className="apex-focusable rounded-[var(--apex-radius-md)] border border-[var(--apex-border)] px-3 py-2 text-xs text-[var(--apex-fg-muted)] hover:text-[var(--apex-fg)]"
        >
          {t("matchCenter")}
        </Link>
      </div>
    </Card>
  );
}

"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { cx } from "@/components/design-system/utils";
import {
  opportunityAnalysisHref,
  opportunityBankrollHref,
  opportunityCopilotHref,
} from "@/lib/apex-opportunities/hrefs";
import type { ApexOpportunity } from "@/lib/apex-opportunities/types";

type OpportunityActionsProps = {
  row: ApexOpportunity;
  watched: boolean;
  onWatch: () => void;
  compact?: boolean;
};

const ghost =
  "apex-focusable inline-flex items-center justify-center rounded-[var(--apex-radius-md)] border border-[var(--apex-border)] px-2.5 py-1.5 text-[11px] font-medium text-[var(--apex-fg-muted)] transition-colors hover:border-[var(--apex-accent-border)] hover:text-[var(--apex-fg)]";

const primary =
  "apex-focusable inline-flex items-center justify-center rounded-[var(--apex-radius-md)] bg-[var(--apex-accent)] px-2.5 py-1.5 text-[11px] font-semibold text-[var(--apex-fg-inverse)] transition-colors hover:bg-[var(--apex-accent-hover)]";

export function OpportunityActions({
  row,
  watched,
  onWatch,
  compact = false,
}: OpportunityActionsProps) {
  const t = useTranslations("common");
  return (
    <div className={cx("flex flex-wrap gap-1.5", compact && "justify-end")}>
      <Link href={opportunityAnalysisHref(row.fixtureId)} className={primary}>
        {t("openAnalysis")}
      </Link>
      <button type="button" onClick={onWatch} className={ghost}>
        {watched ? t("watching") : t("addWatchlist")}
      </button>
      <Link href={opportunityBankrollHref(row.fixtureId)} className={ghost}>
        {t("addBankroll")}
      </Link>
      <Link
        href={opportunityCopilotHref(row.home.name, row.away.name, row.fixtureId)}
        className={ghost}
      >
        {t("openCopilot")}
      </Link>
    </div>
  );
}

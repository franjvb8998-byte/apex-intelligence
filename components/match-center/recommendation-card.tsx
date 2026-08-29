"use client";

import { useTranslations } from "next-intl";
import { Badge, Card, CardHeader } from "@/components/design-system";
import type { MatchCenterPreviewDashboard } from "@/lib/match-center/types";

const actionTone = {
  bet: "accent" as const,
  pass: "warning" as const,
  watch: "info" as const,
  reduce_stake: "warning" as const,
  other: "neutral" as const,
};

type RecommendationCardProps = {
  dashboard: MatchCenterPreviewDashboard;
};

export function RecommendationCard({ dashboard }: RecommendationCardProps) {
  const t = useTranslations("matchCenter");
  const { recommendation, valueBet } = dashboard;
  const actionLabel = {
    bet: t("actionBet"),
    pass: t("actionPass"),
    watch: t("actionWatch"),
    reduce_stake: t("actionReduce"),
    other: t("actionOther"),
  } as const;
  return (
    <Card>
      <CardHeader
        title={t("recommendationTitle")}
        description={actionLabel[recommendation.action]}
        action={
          <Badge tone={actionTone[recommendation.action]}>
            {recommendation.priority}
          </Badge>
        }
      />
      <p className="text-base font-semibold text-[var(--apex-fg)]">
        {recommendation.id === "rec-pending"
          ? t("pendingRecommendation")
          : recommendation.title}
      </p>
      <p className="mt-2 text-sm leading-relaxed text-[var(--apex-fg-muted)]">
        {recommendation.rationale}
      </p>
      {valueBet ? (
        <p className="mt-4 text-sm text-[var(--apex-fg-muted)]">
          {t("valueLine", {
            market: valueBet.market.toUpperCase(),
            selection: valueBet.selection,
            edge: (valueBet.edge * 100).toFixed(1),
          })}
          {valueBet.decimalOdds != null && (
            <>
              {" "}
              · {t("oddsShort", { odds: valueBet.decimalOdds.toFixed(2) })}
            </>
          )}
        </p>
      ) : (
        <p className="mt-4 text-sm text-[var(--apex-fg-subtle)]">
          {t("noValueBet")}
        </p>
      )}
    </Card>
  );
}

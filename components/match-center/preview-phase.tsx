"use client";

import { useTranslations } from "next-intl";
import {
  Badge,
  Card,
  CardHeader,
  ConfidenceIndicator,
  MarketChip,
  ProbabilityBars,
  ScoreGauge,
} from "@/components/design-system";
import { ExplanationPanel as DsExplanationPanel } from "@/components/design-system";
import { HeadToHeadCard } from "@/components/match-center/head-to-head-card";
import { InjuriesCard, SuspensionsCard } from "@/components/match-center/injuries-card";
import { LeagueStandingsCard } from "@/components/match-center/league-standings-card";
import { LineupsCard } from "@/components/match-center/lineups-card";
import { MatchBriefingCard } from "@/components/match-center/match-briefing-card";
import { OddsEvCard } from "@/components/match-center/odds-ev-card";
import { RecommendationCard } from "@/components/match-center/recommendation-card";
import { TeamFormCard } from "@/components/match-center/team-form-card";
import { TeamTrendsCard } from "@/components/match-center/team-trends-card";
import { KeyFactors } from "@/components/match-analysis/key-factors";
import { RisksPanel } from "@/components/match-analysis/risks-panel";
import type {
  MatchCenterMeta,
  MatchCenterPreviewData,
} from "@/lib/match-center/types";

type PreviewPhaseProps = {
  data: MatchCenterPreviewData;
  match: MatchCenterMeta;
};

/**
 * Match Center Preview — dashboard profesional pre-partido.
 * Probabilities from Probability Engine; odds/form/H2H/injuries from Data Platform.
 */
export function PreviewPhase({ data, match }: PreviewPhaseProps) {
  const t = useTranslations("matchCenter");
  const common = useTranslations("common");
  const { analysis, hybrid, dashboard } = data;
  const outcomeLabel = {
    home: t("outcomeHome"),
    draw: t("outcomeDraw"),
    away: t("outcomeAway"),
  } as const;
  const confidenceLabel = {
    high: t("confidenceHigh"),
    medium: t("confidenceMedium"),
    low: t("confidenceLow"),
  } as const;
  const lead =
    analysis.predictedOutcome === "home"
      ? analysis.homeTeam.shortName
      : analysis.predictedOutcome === "away"
        ? analysis.awayTeam.shortName
        : t("outcomeDraw");

  return (
    <div className="space-y-6" role="tabpanel" aria-labelledby="match-center-tab-preview">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="info">Preview</Badge>
        <Badge>PE · {hybrid.modelVersion}</Badge>
        {data.source === "mock" && <Badge tone="warning">{t("eloEstimated")}</Badge>}
      </div>

      <MatchBriefingCard match={match} />

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-3">
          <Card>
            <CardHeader
              title={t("winProbTitle")}
              description={t("winProbLead", {
                outcome: outcomeLabel[analysis.predictedOutcome],
              })}
              action={<Badge tone="accent">{lead}</Badge>}
            />
            <ProbabilityBars
              aria-label={t("probsAria")}
              items={[
                {
                  id: "home",
                  label: analysis.homeTeam.shortName,
                  value: analysis.oneXTwo.home,
                },
                { id: "draw", label: common("draw"), value: analysis.oneXTwo.draw },
                {
                  id: "away",
                  label: analysis.awayTeam.shortName,
                  value: analysis.oneXTwo.away,
                },
              ]}
            />
          </Card>

          <div className="grid gap-6 sm:grid-cols-2">
            <Card>
              <CardHeader
                title={t("goalsTitle")}
                description={t("goalsTotal", {
                  value: hybrid.expectedGoals.total.toFixed(2),
                })}
              />
              <dl className="grid grid-cols-2 gap-3 text-center">
                <div>
                  <dt className="text-[11px] uppercase tracking-[var(--apex-tracking-wider)] text-[var(--apex-fg-subtle)]">
                    {analysis.homeTeam.shortName}
                  </dt>
                  <dd className="mt-1 text-2xl font-semibold tabular-nums text-[var(--apex-fg)]">
                    {hybrid.expectedGoals.home.toFixed(2)}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] uppercase tracking-[var(--apex-tracking-wider)] text-[var(--apex-fg-subtle)]">
                    {analysis.awayTeam.shortName}
                  </dt>
                  <dd className="mt-1 text-2xl font-semibold tabular-nums text-[var(--apex-fg)]">
                    {hybrid.expectedGoals.away.toFixed(2)}
                  </dd>
                </div>
              </dl>
            </Card>

            <Card>
              <CardHeader
                title={t("bttsTitle")}
                description={t("bttsDescription")}
              />
              <div className="grid gap-2">
                <MarketChip
                  interactive={false}
                  selected={hybrid.btts.yes >= hybrid.btts.no}
                  label={common("yes")}
                  value={`${Math.round(hybrid.btts.yes * 100)}%`}
                />
                <MarketChip
                  interactive={false}
                  selected={hybrid.btts.no > hybrid.btts.yes}
                  label={common("no")}
                  value={`${Math.round(hybrid.btts.no * 100)}%`}
                />
              </div>
            </Card>
          </div>

          <Card>
            <CardHeader title={t("ou25Title")} />
            <div className="grid gap-2 sm:grid-cols-2">
              <MarketChip
                interactive={false}
                selected={hybrid.overUnder25.over >= 0.5}
                label={common("over25")}
                value={`${Math.round(hybrid.overUnder25.over * 100)}%`}
              />
              <MarketChip
                interactive={false}
                selected={hybrid.overUnder25.under > hybrid.overUnder25.over}
                label={common("under25")}
                value={`${Math.round(hybrid.overUnder25.under * 100)}%`}
              />
            </div>
          </Card>

          <OddsEvCard rows={dashboard.odds} />

          <DsExplanationPanel
            title={t("aiExplanation")}
            summary={analysis.explanation.summary}
            footnotes={analysis.explanation.caveats}
            defaultOpen
          >
            <p className="text-sm leading-relaxed text-[var(--apex-fg-muted)]">
              {analysis.explanation.narrative}
            </p>
          </DsExplanationPanel>
        </div>

        <div className="space-y-6 lg:col-span-2">
          <RecommendationCard dashboard={dashboard} />

          <Card className="flex flex-col items-center gap-4">
            <CardHeader
              className="mb-0 w-full"
              title={t("confidenceTitle")}
              description={t("confidenceBand", {
                band: confidenceLabel[analysis.confidence.band],
                label: analysis.apexScore.label,
              })}
            />
            <ScoreGauge
              value={analysis.apexScore.value}
              label="Score"
              caption={outcomeLabel[analysis.predictedOutcome]}
            />
            <ConfidenceIndicator
              value={analysis.confidence.value}
              band={analysis.confidence.band}
              className="w-full"
            />
          </Card>

          <KeyFactors factors={analysis.keyFactors} />
          <RisksPanel risks={analysis.risks} />
        </div>
      </div>

      <LeagueStandingsCard
        home={dashboard.standings.home}
        away={dashboard.standings.away}
        leagueName={match.leagueName}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <TeamFormCard home={dashboard.form.home} away={dashboard.form.away} />
        <HeadToHeadCard meetings={dashboard.h2h} />
      </div>

      <TeamTrendsCard
        homeName={match.homeTeam.name}
        awayName={match.awayTeam.name}
        home={dashboard.trends.home}
        away={dashboard.trends.away}
      />

      <LineupsCard
        home={dashboard.lineups?.home ?? null}
        away={dashboard.lineups?.away ?? null}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <InjuriesCard injuries={dashboard.injuries ?? []} />
        <SuspensionsCard suspensions={dashboard.suspensions ?? []} />
      </div>
    </div>
  );
}

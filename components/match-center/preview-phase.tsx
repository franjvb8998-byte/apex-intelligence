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
import { KeyFactors } from "@/components/match-analysis/key-factors";
import { RisksPanel } from "@/components/match-analysis/risks-panel";
import type { MatchCenterPreviewData } from "@/lib/match-center/types";

const outcomeLabel = {
  home: "Victoria local",
  draw: "Empate",
  away: "Victoria visitante",
} as const;

type PreviewPhaseProps = {
  data: MatchCenterPreviewData;
};

/**
 * Preview cards — consume MatchCenterPreviewData.
 * Probabilities originate from ProbabilityEngine via the adapter;
 * swap `source` when Core is wired.
 */
export function PreviewPhase({ data }: PreviewPhaseProps) {
  const { analysis, hybrid } = data;
  const lead =
    analysis.predictedOutcome === "home"
      ? analysis.homeTeam.shortName
      : analysis.predictedOutcome === "away"
        ? analysis.awayTeam.shortName
        : "Empate";

  return (
    <div className="space-y-6" role="tabpanel" aria-labelledby="match-center-tab-preview">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="info">Preview</Badge>
        <Badge>PE · {hybrid.modelVersion}</Badge>
        {data.source === "mock" && <Badge tone="warning">Elo simulado</Badge>}
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-3">
          <Card>
            <CardHeader
              title="Probabilidad 1X2"
              description={`Lectura principal: ${outcomeLabel[analysis.predictedOutcome]}`}
              action={<Badge tone="accent">{lead}</Badge>}
            />
            <ProbabilityBars
              aria-label="Probabilidades 1X2"
              items={[
                {
                  id: "home",
                  label: analysis.homeTeam.shortName,
                  value: analysis.oneXTwo.home,
                },
                { id: "draw", label: "Empate", value: analysis.oneXTwo.draw },
                {
                  id: "away",
                  label: analysis.awayTeam.shortName,
                  value: analysis.oneXTwo.away,
                },
              ]}
            />
          </Card>

          <Card>
            <CardHeader
              title="Mercados"
              description={`xG esperado ${hybrid.expectedGoals.home.toFixed(2)} – ${hybrid.expectedGoals.away.toFixed(2)}`}
            />
            <div className="grid gap-2 sm:grid-cols-2">
              <MarketChip
                interactive={false}
                selected={hybrid.overUnder25.over >= 0.5}
                label="Over 2.5"
                value={`${Math.round(hybrid.overUnder25.over * 100)}%`}
              />
              <MarketChip
                interactive={false}
                selected={hybrid.overUnder25.under > hybrid.overUnder25.over}
                label="Under 2.5"
                value={`${Math.round(hybrid.overUnder25.under * 100)}%`}
              />
            </div>
          </Card>

          <DsExplanationPanel
            title="Explicación APEX"
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
          <Card className="flex flex-col items-center gap-4">
            <CardHeader
              className="mb-0 w-full"
              title="APEX Score"
              description={analysis.apexScore.label}
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
    </div>
  );
}

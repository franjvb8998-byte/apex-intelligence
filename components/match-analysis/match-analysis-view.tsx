import { ApexScoreCard } from "@/components/match-analysis/apex-score-card";
import { ExplanationPanel } from "@/components/match-analysis/explanation-panel";
import { KeyFactors } from "@/components/match-analysis/key-factors";
import { MarketsPanel } from "@/components/match-analysis/markets-panel";
import { MatchHeader } from "@/components/match-analysis/match-header";
import { Probability1x2 } from "@/components/match-analysis/probability-1x2";
import { RisksPanel } from "@/components/match-analysis/risks-panel";
import type { MatchAnalysisData } from "@/lib/match-analysis/types";

const outcomeLabel = {
  home: "Victoria local",
  draw: "Empate",
  away: "Victoria visitante",
} as const;

type MatchAnalysisViewProps = {
  data: MatchAnalysisData;
};

/**
 * Presentational composition for Match Analysis.
 * Pass Core-mapped `MatchAnalysisData` when the pipeline is wired.
 */
export function MatchAnalysisView({ data }: MatchAnalysisViewProps) {
  return (
    <div className="w-full space-y-8">
      <MatchHeader
        leagueName={data.leagueName}
        kickoffAt={data.kickoffAt}
        status={data.status}
        homeName={data.homeTeam.name}
        homeShort={data.homeTeam.shortName}
        awayName={data.awayTeam.name}
        awayShort={data.awayTeam.shortName}
        source={data.source}
      />

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-3">
          <Probability1x2
            probabilities={data.oneXTwo}
            homeLabel={data.homeTeam.shortName}
            awayLabel={data.awayTeam.shortName}
          />
          <MarketsPanel markets={data.markets} />
          <ExplanationPanel
            explanation={data.explanation}
            modelVersion={data.modelVersion}
          />
        </div>

        <div className="space-y-6 lg:col-span-2">
          <ApexScoreCard
            apexScore={data.apexScore}
            confidence={data.confidence}
            predictedLabel={outcomeLabel[data.predictedOutcome]}
          />
          <KeyFactors factors={data.keyFactors} />
          <RisksPanel risks={data.risks} />
        </div>
      </div>
    </div>
  );
}

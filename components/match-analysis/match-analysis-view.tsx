import { ApexScoreCard } from "@/components/match-analysis/apex-score-card";
import {
  FormChart,
  GoalsChart,
  HeadToHeadChart,
  LeaguePositionChart,
  MatchMetricsChart,
  VenueSplitChart,
} from "@/components/match-analysis/analysis-charts";
import { ExplanationPanel } from "@/components/match-analysis/explanation-panel";
import { KeyFactors } from "@/components/match-analysis/key-factors";
import { MarketsPanel } from "@/components/match-analysis/markets-panel";
import { MatchHeader } from "@/components/match-analysis/match-header";
import { Probability1x2 } from "@/components/match-analysis/probability-1x2";
import { RisksPanel } from "@/components/match-analysis/risks-panel";
import { ExplainablePredictionPanel } from "@/components/explainable-ai";
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
        homeLogoUrl={data.homeTeam.logoUrl}
        awayName={data.awayTeam.name}
        awayShort={data.awayTeam.shortName}
        awayLogoUrl={data.awayTeam.logoUrl}
        source={data.source}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <LeaguePositionChart
          home={data.leaguePosition.home}
          away={data.leaguePosition.away}
          homeName={data.homeTeam.name}
          awayName={data.awayTeam.name}
        />
        <FormChart
          homeName={data.homeTeam.name}
          awayName={data.awayTeam.name}
          home={data.recentMatches.home}
          away={data.recentMatches.away}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <HeadToHeadChart meetings={data.h2h} />
        <GoalsChart
          homeName={data.homeTeam.name}
          awayName={data.awayTeam.name}
          home={data.recentMatches.home}
          away={data.recentMatches.away}
        />
      </div>

      <VenueSplitChart
        homeName={data.homeTeam.name}
        awayName={data.awayTeam.name}
        home={data.venueSplit.home}
        away={data.venueSplit.away}
      />

      <MatchMetricsChart
        homeName={data.homeTeam.name}
        awayName={data.awayTeam.name}
        home={data.matchMetrics.home}
        away={data.matchMetrics.away}
        modelXg={data.expectedGoals}
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

      <ExplainablePredictionPanel data={data.explainable} />
    </div>
  );
}

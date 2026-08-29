import { PremiumMatchAnalysis } from "@/components/match-analysis/premium-view";
import type { MatchAnalysisData } from "@/lib/match-analysis/types";

type MatchAnalysisViewProps = {
  data: MatchAnalysisData;
};

/**
 * Match Analysis Premium v3 — presentation over published engines.
 */
export function MatchAnalysisView({ data }: MatchAnalysisViewProps) {
  return <PremiumMatchAnalysis data={data} />;
}

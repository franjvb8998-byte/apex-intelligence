/**
 * Structured “why” from published Decision Engine fields.
 */

import { opportunityBlurb } from "@/lib/apex-opportunities/blurb";
import type { ApexOpportunity } from "@/lib/apex-opportunities/types";
import { scannerRecommendation } from "@/lib/opportunity-scanner/recommend";

export type ScannerExplanation = {
  recommendation: ReturnType<typeof scannerRecommendation>;
  why: string;
  supporting: Array<{ title: string; detail: string }>;
  risks: Array<{ title: string; detail: string }>;
  fairOdds: number | null;
  stakePct: number;
  stakeLabel: string;
  kellyPct: number | null;
};

export function explainOpportunity(row: ApexOpportunity): ScannerExplanation {
  const supporting =
    row.reasonsFor.length > 0
      ? row.reasonsFor.map((reason) => ({
          title: reason.title,
          detail: reason.detail,
        }))
      : [
          {
            title: "Engine narrative",
            detail: row.explanation,
          },
        ];

  const risks =
    row.reasonsAgainst.length > 0
      ? row.reasonsAgainst.map((reason) => ({
          title: reason.title,
          detail: reason.detail,
        }))
      : [
          {
            title: `Risk ${row.riskBand}`,
            detail: `Published risk score ${row.riskScore}. This is not a guarantee the pick loses.`,
          },
        ];

  return {
    recommendation: scannerRecommendation(row),
    why: opportunityBlurb(row),
    supporting,
    risks,
    fairOdds: row.fairOdds,
    stakePct: row.stakePct,
    stakeLabel: row.stakeLabel,
    kellyPct: row.kellyPct,
  };
}

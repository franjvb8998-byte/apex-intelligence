/**
 * Side-effect persist for Decision Engine recommendations.
 * Failures never break scoring, Match Analysis, or the scanner.
 */

import {
  journalWriteFromMatchSelection,
  journalWriteFromOpportunity,
} from "@/lib/prediction-journal/from-selection";
import { getPredictionJournalService } from "@/lib/prediction-journal/service";
import type { PredictionJournalEntry } from "@/lib/prediction-journal/types";
import type { ApexOpportunity } from "@/lib/apex-opportunities/types";
import type { ApexDecision } from "@/lib/decision-engine/types";
import type { MatchAnalysisCore } from "@/lib/decision-engine/from-match";
import type { ApexScoring } from "@/lib/scoring-engine/types";

export function persistMatchPrediction(input: {
  analysis: MatchAnalysisCore;
  decision: ApexDecision;
  scoring: ApexScoring;
  bookmakerOdds?: number | null;
  season?: string | null;
}): PredictionJournalEntry | null {
  try {
    return getPredictionJournalService().savePrediction(
      journalWriteFromMatchSelection(input),
    );
  } catch {
    return null;
  }
}

export function persistOpportunityPrediction(input: {
  row: ApexOpportunity;
  decision: ApexDecision;
  scoring?: ApexScoring;
  season?: string | null;
}): PredictionJournalEntry | null {
  try {
    return getPredictionJournalService().savePrediction(
      journalWriteFromOpportunity(input),
    );
  } catch {
    return null;
  }
}

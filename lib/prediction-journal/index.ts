/**
 * APEX Prediction Journal MVP.
 *
 * Captures every Decision Engine recommendation after it is produced.
 * Does not change Decision Engine math. Does not settle results.
 *
 *   import { getPredictionJournalService } from "@/lib/prediction-journal";
 */

export type {
  PredictionId,
  PredictionJournalEntry,
  PredictionJournalFilter,
  PredictionJournalMarket,
  PredictionJournalPatch,
  PredictionJournalStatus,
  PredictionJournalWrite,
} from "@/lib/prediction-journal/types";

export { predictionIdFromParts } from "@/lib/prediction-journal/ids";
export {
  journalWriteFromMatchSelection,
  journalWriteFromOpportunity,
} from "@/lib/prediction-journal/from-selection";
export {
  persistMatchPrediction,
  persistOpportunityPrediction,
} from "@/lib/prediction-journal/capture";
export {
  PredictionJournalService,
  getPredictionJournalService,
  resetPredictionJournalService,
} from "@/lib/prediction-journal/service";
export { InMemoryPredictionJournalStore } from "@/lib/prediction-journal/memory";

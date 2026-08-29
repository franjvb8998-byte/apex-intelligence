export type {
  ComboAnalysis,
  ComboBuildResult,
  ComboBuildSpec,
  ComboCorrelationKind,
  ComboCorrelationReport,
  ComboLeg,
  ComboMarket,
  ComboMonteCarlo,
  ComboOptimization,
  ComboPairCorrelation,
  ComboRiskProfile,
  ComboSwapSuggestion,
  ComboTeam,
  DailyComboKind,
  DailySmartCombo,
  DailySmartCombosBoard,
} from "@/lib/smart-combos/types";

export { analyzeCombo } from "@/lib/smart-combos/analyze";
export { buildCombo } from "@/lib/smart-combos/build";
export { analyzeCorrelation, correlationMatrix } from "@/lib/smart-combos/correlation";
export { buildDailySmartCombos } from "@/lib/smart-combos/daily";
export {
  apexProbabilityFromOpportunity,
  legsFromOpportunities,
  opportunityToComboLeg,
  pricedLegs,
  uniqueLeagues,
} from "@/lib/smart-combos/legs";
export { optimizeCombo } from "@/lib/smart-combos/optimize";
export {
  combinedDecimalOdds,
  comboExpectedValue,
  comboImpliedProbability,
  comboQuarterKelly,
  independentApexProbability,
  weakestLeg,
} from "@/lib/smart-combos/pricing";
export {
  DEFAULT_COMBO_SEED,
  DEFAULT_COMBO_TRIALS,
  simulateCombo,
} from "@/lib/smart-combos/simulate";
export { loadSmartCombosDesk } from "@/lib/smart-combos/load";
export {
  COMBO_SLIP_STORAGE_KEY,
  parseComboSlip,
  readComboSlip,
  serializeComboSlip,
  writeComboSlip,
} from "@/lib/smart-combos/slip-storage";

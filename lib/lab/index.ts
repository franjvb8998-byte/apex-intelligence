export type {
  LabBacktest,
  LabBacktestMark,
  LabBar,
  LabDecisionView,
  LabEngineCompareRow,
  LabFeatureSeries,
  LabKpi,
  LabModelId,
  LabModelRecord,
  LabModelStatus,
  LabPaperResult,
  LabPoint,
  LabStrategySpec,
  LabTableColumn,
  LabTableRow,
  LabWorkspace,
} from "@/lib/lab/types";

export { LAB_MODELS, LAB_SECTIONS, modelById } from "@/lib/lab/registry";
export type { LabSectionId } from "@/lib/lab/registry";

export {
  ALL_VERDICTS,
  DEFAULT_LAB_STRATEGY,
  LAB_STRATEGY_PRESETS,
  STAKE_VERDICTS,
  labStrategyPasses,
  paperLabStrategy,
} from "@/lib/lab/strategy";

export { simulateUnitMarks } from "@/lib/lab/backtest";
export { buildComparison } from "@/lib/lab/compare";
export { buildFeatureSeries, decisionWeightBars } from "@/lib/lab/features";
export { buildLabWorkspace, buildDecisionView } from "@/lib/lab/build";
export {
  loadLabBook,
  loadLabFeatured,
  loadLabResearch,
  loadLabScan,
} from "@/lib/lab/load";

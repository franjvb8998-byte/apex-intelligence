/**
 * Offline calibration harness (Sprint 5B.3A).
 * Not imported by production runtime.
 */

export {
  CALIBRATION_ARTIFACT_DIR,
  CALIBRATION_AWAY_BASE,
  CALIBRATION_COLLECTOR_VERSION,
  CALIBRATION_HOME_BASE,
  CALIBRATION_RECONSTRUCTION_VERSION,
  CALIBRATION_SCHEMA_VERSION,
} from "@/lib/debug/calibration/types";
export type {
  CalibrationOddsTiming,
  CalibrationOutcome,
  CalibrationRow,
  CollectionRunMetadata,
  EloPolicyId,
  EvidenceBucket,
  LeagueSeasonSelection,
  OneXTwo,
  ReconstructionFixture,
  SeasonListPaging,
  TeamRecordBefore,
} from "@/lib/debug/calibration/types";

export {
  buildCalibrationRow,
  compareFixturesDeterministically,
  countableGoals,
  COUNTABLE_STATUSES,
  dedupeReconstructionFixtures,
  eligibleTargetGoals,
  evidenceBucket,
  fixtureCalibrationRole,
  outcomeFromScore,
  reconstructTeamRecord,
  rowEvidenceBucket,
} from "@/lib/debug/calibration/reconstruct";

export {
  createBasePriorPolicy,
  createCurrentCataloguePolicy,
  createDefaultEloPolicies,
  createExponentialShrinkagePolicy,
  createLinearShrinkagePolicy,
  createPseudoMatchBayesianPolicy,
  createShrinkagePlusCapPolicy,
  DEFAULT_ELO_POLICY_PARAMS,
  EXPERIMENTAL_PLACEHOLDER_ELO_POLICY_PARAMS,
} from "@/lib/debug/calibration/policies";
export type { EloPolicy, EloPolicyParams, ResolvedSideElo } from "@/lib/debug/calibration/policies";

export {
  BOOKMAKER_ODDS_TIMING_DISCLAIMER,
  bookmakerBaselineReportLabel,
  impliedProbabilitiesFromDecimalOdds,
  oddsMayBeDescribedAsKnownAtKickoff,
} from "@/lib/debug/calibration/bookmaker";

export {
  brierOneXTwo,
  expectedCalibrationError,
  isValidOneXTwo,
  LOG_LOSS_EPS,
  logLossOneXTwo,
  summarizeMetrics,
  stratifyMetrics,
} from "@/lib/debug/calibration/metrics";

export {
  bookmakerMetricRows,
  evaluateCalibrationRows,
  scoreRowWithPolicy,
  scoreRowsWithPolicies,
} from "@/lib/debug/calibration/evaluate";

export {
  createSyntheticCalibrationRows,
  createSyntheticLeagueFixtures,
} from "@/lib/debug/calibration/synthetic";

export {
  estimateCollectionBudget,
  PILOT_COLLECTION_STAGES,
  recommendedCollectionStrategy,
  seasonListCallCount,
} from "@/lib/debug/calibration/collection-budget";

export {
  assertChronologicalSplit,
  assignChronologicalFold,
  EXAMPLE_CHRONOLOGICAL_SPLIT,
} from "@/lib/debug/calibration/split";

export {
  assertSeasonListCompleteForCalibration,
  buildLabeledCalibrationRows,
  createCollectionRunMetadata,
  IncompleteSeasonListError,
  planFixtureListPages,
  prepareCalibrationFixtures,
} from "@/lib/debug/calibration/collector-integrity";

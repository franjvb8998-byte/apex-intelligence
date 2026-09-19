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

export {
  MICROCOLLECTION_FIXTURE_LIST_LOGICAL_CALLS,
  MICROCOLLECTION_LEAGUE_ID,
  MICROCOLLECTION_LEAGUE_NAME,
  MICROCOLLECTION_LOGICAL_CALL_CEILING,
  MICROCOLLECTION_ORIGIN_CEILING,
  MICROCOLLECTION_SEASON,
  MICROCOLLECTION_SELECTION_RULE,
  MICROCOLLECTION_TARGET_COUNT,
} from "@/lib/debug/calibration/micro-shape";

export {
  collectMicrodataset,
  MicrocollectOddsLookupError,
  reportMicrocollectCliResult,
} from "@/lib/debug/calibration/microcollect";
export {
  assertCalibrationFixtureEnvelope,
  assertMicrocollectionTargetContract,
  MicrocollectEmptySeasonError,
  MicrocollectNoEligibleTargetsError,
  MicrocollectTargetShortfallError,
  MicrocollectVendorEnvelopeError,
} from "@/lib/debug/calibration/season-contract";
export { loadCalibrationDataset } from "@/lib/debug/calibration/persist";
export {
  assertLiveCollectionAuthorized,
  CallBudgetExceededError,
  LiveCollectionGuardError,
  planMicrocollectionLogicalCalls,
} from "@/lib/debug/calibration/live-guard";

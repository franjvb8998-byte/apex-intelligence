/**
 * PE-4 — Competition-scoped form & schedule evidence (offline).
 * Evidence / provenance only — does not change PE probabilities.
 */

export {
  PE4_DEFAULT_LAST_N,
  PE4_FORM_SCHEDULE_CONTEXT_LAYER_KEY,
  PE4_FORM_SCHEDULE_LAYER_VERSION,
  PE4_FORM_SCHEDULE_SCOPE_COMPETITION_SEASON,
  PE4_COMMON_BASELINE_STRENGTH_SEMANTICS,
  PE4_OPPONENT_STRENGTH_SEMANTICS,
  type Pe4CommonBaselineStrengthSemantics,
  type Pe4ComponentStatus,
  type Pe4ComponentStatusCode,
  type Pe4FormScheduleContextLayer,
  type Pe4FormScheduleExtractErr,
  type Pe4FormScheduleExtractInput,
  type Pe4FormScheduleExtractOk,
  type Pe4FormScheduleExtractResult,
  type Pe4FormScheduleScope,
  type Pe4FormScheduleTarget,
  type Pe4HistoricalExpectationEvidence,
  type Pe4HistoricalResidualEvidence,
  type Pe4MatchResult,
  type Pe4OpponentAdjustedCoverageKind,
  type Pe4OpponentStrengthCoverage,
  type Pe4OpponentStrengthEvidence,
  type Pe4OpponentStrengthSemantics,
  type Pe4OpponentStrengthUnavailableReason,
  type Pe4PairwiseHistoricalStrengthContext,
  type Pe4PairwiseStrengthCoverage,
  type Pe4PairwiseStrengthQualityKind,
  type Pe4PriorMatchSummary,
  type Pe4RollingWindowCounts,
  type Pe4SideAggregate,
  type Pe4SideEvidence,
  type Pe4TargetStrengthCoverage,
  type Pe4TargetStrengthEvidence,
  type Pe4UnavailableReason,
  type Pe4VenueRole,
} from "@/lib/prematch-decision/pe4-form-schedule/types";

export {
  digestPe4FormScheduleContextLayer,
  digestPe4FormScheduleEvidence,
  PE4_FORM_SCHEDULE_EVIDENCE_DIGEST_VERSION,
} from "@/lib/prematch-decision/pe4-form-schedule/digest";

export {
  extractPe4FormScheduleEvidence,
  tryBuildTeamPriorSummary,
} from "@/lib/prematch-decision/pe4-form-schedule/extract";

export {
  attachHistoricalOpponentStrength,
  attachHistoricalTwoSidedStrength,
  createPe4OpponentStrengthMemo,
  PE4C_OPPONENT_STRENGTH_RECONSTRUCTION_BASE,
  PE4C_OPPONENT_STRENGTH_SYNTHETIC_AWAY_ID,
  resolveHistoricalOpponentStrength,
  resolveHistoricalTargetStrength,
  summarizeOpponentStrengthCoverage,
  summarizePairwiseStrengthCoverage,
  summarizeTargetStrengthCoverage,
} from "@/lib/prematch-decision/pe4-form-schedule/opponent-strength";

export {
  createPe4HistoricalStrengthMemo,
  PE4_COMMON_BASELINE_RECONSTRUCTION_BASE,
  PE4_COMMON_BASELINE_SYNTHETIC_AWAY_ID,
  pe4HistoricalStrengthMemoKey,
  resolveHistoricalCommonBaselineStrength,
} from "@/lib/prematch-decision/pe4-form-schedule/historical-strength";

export { buildPe4PairwiseHistoricalStrengthContext } from "@/lib/prematch-decision/pe4-form-schedule/pairwise-strength";

export {
  PE4_HISTORICAL_EXPECTATION_ENGINE_REUSE_AUDIT,
  PE4_HISTORICAL_EXPECTATION_MODEL_VERSION,
  PE4_HISTORICAL_EXPECTATION_UNAVAILABLE_REASON,
  resolvePe4HistoricalExpectation,
  resolvePe4HistoricalExpectationFromPairwise,
  resolvePe4HistoricalResidual,
  type Pe4HistoricalExpectationInput,
} from "@/lib/prematch-decision/pe4-form-schedule/expectation-contract";

export {
  isPe4FormScheduleContextLayer,
  readPe4FormScheduleContextLayer,
  withPe4FormScheduleContextLayer,
} from "@/lib/prematch-decision/pe4-form-schedule/provenance";

export {
  PE4_EXTRACTION_FATAL_CASES,
  PE4_FAIL_CLOSED_MATRIX,
  type Pe4FailClosedCase,
  type Pe4FailClosedEntry,
  type Pe4FailClosedOutcomeKind,
} from "@/lib/prematch-decision/pe4-form-schedule/fail-closed";

export {
  acquirePe4TeamSchedule,
  buildPe4CrossCompScheduleProvenanceFragment,
  classifyPe4CompetitionLoad,
  createRunScopedPe4TeamScheduleCache,
  digestPe4CrossCompScheduleSide,
  evaluatePe4TeamScheduleProviderEnvelope,
  extractPe4CrossCompScheduleSide,
  mergePe4CompetitionScopedWithCrossCompSchedule,
  normalizePe4TeamScheduleFixtures,
  pe4CongestionWindowBounds,
  pe4LoadClassCountsTowardSemanticSchedule,
  pe4TeamScheduleCacheKey,
  requestedWindowCoversCongestionInterval,
  PE4_COMPETITION_SCOPED_SCHEDULE_SOURCE,
  PE4_CROSS_COMP_SCHEDULE_SOURCE,
  PE4_TEAM_SCHEDULE_EVIDENCE_DIGEST_VERSION,
  type AcquirePe4TeamScheduleInput,
  type ExtractPe4CrossCompScheduleSideInput,
  type NormalizeTeamScheduleResult,
  type Pe4CompetitionLoadClass,
  type Pe4CrossCompScheduleProvenanceFragment,
  type Pe4CrossCompScheduleSideEvidence,
  type Pe4MergedFormScheduleEvidence,
  type Pe4ScheduleEvidenceSource,
  type Pe4TeamScheduleAcquireErr,
  type Pe4TeamScheduleAcquireKey,
  type Pe4TeamScheduleAcquireOk,
  type Pe4TeamScheduleAcquireResult,
  type Pe4TeamScheduleAcquisitionScope,
  type Pe4TeamScheduleFixture,
  type Pe4TeamScheduleLoader,
  type Pe4TeamScheduleProviderEnvelope,
  type RunScopedPe4TeamScheduleCache,
} from "@/lib/prematch-decision/pe4-form-schedule/schedule";

export {
  assignPe4ExpectationSplitName,
  buildPe4ExpectationDataset,
  buildPe4ExpectationDatasetRow,
  buildPe4ExpectationSplitManifests,
  comparePe4ExpectationRows,
  describePe4ExpectationDataset,
  digestPe4ExpectationDataset,
  digestPe4ExpectationFixtureIds,
  pe4ExpectationCanonicalKey,
  pe4ExpectationQualityKind,
  reconstructPe4CommonBaselineStrength,
  PE4_EXPECTATION_COMMON_BASELINE,
  PE4_EXPECTATION_DATASET_BUILDER_VERSION,
  PE4_EXPECTATION_DATASET_DIGEST_VERSION,
  PE4_EXPECTATION_DATASET_SCHEMA_VERSION,
  PE4_EXPECTATION_DEFAULT_SEASON_SPLITS,
  PE4_EXPECTATION_DIAGNOSTIC_D_RANGES,
  PE4_EXPECTATION_ROLLING_ORIGIN_PLAN,
  type BuildPe4ExpectationDatasetInput,
  type BuildPe4ExpectationDatasetResult,
  type BuildPe4ExpectationRowResult,
  type Pe4ExpectationActualOutcome,
  type Pe4ExpectationDatasetManifest,
  type Pe4ExpectationDatasetRow,
  type Pe4ExpectationDatasetSplitName,
  type Pe4ExpectationQualityKind,
  type Pe4ExpectationSplitManifest,
  type Pe4ExpectationStrengthSource,
} from "@/lib/prematch-decision/pe4-form-schedule/expectation";

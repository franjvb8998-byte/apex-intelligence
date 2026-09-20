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
  EvidenceBucketCounts,
  LeagueSeasonSelection,
  OneXTwo,
  PilotRunMetadata,
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
export {
  loadCalibrationDataset,
  loadPilotArtifacts,
  writePilotArtifacts,
} from "@/lib/debug/calibration/persist";
export {
  assertLiveCollectionAuthorized,
  CallBudgetExceededError,
  LiveCollectionGuardError,
  planMicrocollectionLogicalCalls,
  planPilotLogicalCalls,
  planValidationLogicalCalls,
} from "@/lib/debug/calibration/live-guard";
export {
  PILOT_FIXTURE_LIST_LOGICAL_CALLS,
  PILOT_LEAGUE_ID,
  PILOT_LEAGUE_NAME,
  PILOT_LOGICAL_CALL_CEILING,
  PILOT_ODDS_LOGICAL_CALLS,
  PILOT_SEASON,
  PILOT_SELECTION_ALGORITHM,
  PILOT_TARGET_COUNT,
  PILOT_VERSION,
} from "@/lib/debug/calibration/pilot-shape";
export {
  allocatedPilotBucketCounts,
  countEvidenceBuckets,
  desiredPilotBucketAllocation,
  selectPilotRows,
} from "@/lib/debug/calibration/select-pilot";
export {
  collectPilotDataset,
  createPilotRunMetadata,
  reportPilotCliResult,
  runAuthorizedPilot,
} from "@/lib/debug/calibration/pilot-collect";
export {
  buildPilotDiagnostics,
  evaluateNaturalFullPopulation,
  evaluatePilotRows,
  evaluateStratifiedDiagnosticSample,
  NATURAL_FULL_POPULATION_LABEL,
  STRATIFIED_DIAGNOSTIC_SAMPLE_LABEL,
} from "@/lib/debug/calibration/pilot-diagnostics";
export {
  decomposeZeroEvidenceHomeAdvantage,
  EQUALIZED_ROLE_ELO,
  predictForensicMatchup,
  productionHomeAdvantageComponents,
} from "@/lib/debug/calibration/pilot-ha-forensics";
export {
  decomposeCatalogueElo,
  sparseCatalogueGaps,
} from "@/lib/debug/calibration/catalogue-forensics";
export { createLivePilotTransport, createLiveValidationTransport } from "@/lib/debug/calibration/live-transport";
export {
  EQUALIZED_ROLE_ELO as EXPERIMENT_EQUALIZED_ROLE_ELO,
  EXPERIMENT_HA_CONFIGS,
  NEUTRAL_GOAL_BASELINE_N1,
  NEUTRAL_GOAL_BASELINE_N2,
  productionHaConstants,
} from "@/lib/debug/calibration/experiment-5b5-ha";
export {
  evaluateFactorialExperiment,
  scoreRowWithHaConfig,
} from "@/lib/debug/calibration/experiment-5b5-evaluate";
export {
  loadFrozenNaturalPopulation,
  SPRINT_5B5_META_PATH,
  SPRINT_5B5_POPULATION_PATH,
  verifyFrozenNaturalPopulation,
} from "@/lib/debug/calibration/experiment-5b5-dataset";
export {
  buildExperiment5b5Report,
  writeExperiment5b5Artifact,
} from "@/lib/debug/calibration/experiment-5b5-report";
export {
  FROZEN_VALIDATION_CONFIGS,
  frozenValidationConfig,
} from "@/lib/debug/calibration/validation-5b6-configs";
export {
  VALIDATION_DEVELOPMENT_SEASON,
  VALIDATION_HOLDOUT_SEASONS,
  VALIDATION_LEAGUE_ID,
  VALIDATION_LOGICAL_CALL_CEILING,
} from "@/lib/debug/calibration/validation-5b6-shape";
export {
  collectValidationHoldouts,
  collectValidationSeason,
} from "@/lib/debug/calibration/validation-5b6-collect";
export { evaluateValidationSeason } from "@/lib/debug/calibration/validation-5b6-evaluate";
export {
  aggregateHoldoutSeasons,
  buildCrossSeasonValidationReport,
  interpretReplication,
  PL_2024_DEVELOPMENT_REFERENCE,
} from "@/lib/debug/calibration/validation-5b6-report";
export {
  loadValidationSeasonArtifacts,
  writeValidationSeasonArtifacts,
} from "@/lib/debug/calibration/validation-5b6-persist";
export {
  DRAW_FORENSICS_CONFIG_IDS,
  DRAW_FORENSICS_DEVELOPMENT_SEASON,
  DRAW_FORENSICS_HOLDOUT_SEASONS,
  DECLARED_ELO_DRAW_BASE_GRID,
} from "@/lib/debug/calibration/draw-5b7-shape";
export {
  PRODUCTION_DRAW_FORMULA_AUDIT,
  PRODUCTION_ELO_DRAW_BASE,
} from "@/lib/debug/calibration/draw-5b7-formula";
export {
  eloGapBucket,
  scorelineGroup,
  totalXgBucket,
  xgDiffBucket,
} from "@/lib/debug/calibration/draw-5b7-buckets";
export { evaluateDrawForensicsConfigs, extractExtremeDrawMisses } from "@/lib/debug/calibration/draw-5b7-evaluate";
export {
  eloDrawBaseSensitivityValues,
  evaluateEloDrawBaseSensitivity,
} from "@/lib/debug/calibration/draw-5b7-sensitivity";
export { classifyComponentAttribution } from "@/lib/debug/calibration/draw-5b7-report";
export {
  loadDrawForensicsDatasets,
  loadDrawForensicsSeason,
  MissingDrawForensicsArtifactError,
  requireLocalArtifact,
} from "@/lib/debug/calibration/draw-5b7-dataset";
export { DECLARED_DIXON_COLES_RHO_GRID } from "@/lib/debug/calibration/dc-5b8-shape";
export { PRODUCTION_POISSON_AUDIT } from "@/lib/debug/calibration/dc-5b8-formula";
export {
  assertValidDixonColesTau,
  dixonColesTau,
  independentPoissonGrid,
  observedScorelineKey,
} from "@/lib/debug/calibration/dc-5b8-dixon-coles";
export { evaluateSeasonPoissonForensics } from "@/lib/debug/calibration/dc-5b8-evaluate";
export { evaluateDixonColesSensitivity } from "@/lib/debug/calibration/dc-5b8-sensitivity";
export { classifyDcForensics } from "@/lib/debug/calibration/dc-5b8-report";
export {
  DECLARED_ELO_DIFF_GRID,
  DECLARED_ELO_GOAL_SCALE_GRID,
  DECLARED_EXPONENT_GAPS,
  LAMBDA_RATIO_BUCKETS,
} from "@/lib/debug/calibration/xg-5b9-shape";
export {
  PRODUCTION_ELO_XG_AUDIT,
  assertMirrorsProductionEloToExpectedGoals,
  debugClampLambda,
  eloToExpectedGoalsUnclamped,
  eloToExpectedGoalsMirrored,
  productionAnalyticClampThresholds,
} from "@/lib/debug/calibration/xg-5b9-formula";
export {
  analyticEloGapGeometry,
  exponentMultiplier,
  lambdaRatio,
  lambdaRatioBucket,
  productionExponentMultipliers,
  totalXg,
} from "@/lib/debug/calibration/xg-5b9-geometry";
export {
  clampCohortOf,
  evaluateSeasonLambdaGeometry,
  extractTopBy,
  snapshotLambdaSeason,
} from "@/lib/debug/calibration/xg-5b9-evaluate";
export {
  evaluateDenominatorSensitivity,
  evaluateGoalBaseVariants,
  unclampedCounterfactual,
} from "@/lib/debug/calibration/xg-5b9-counterfactual";
export { classifyXgGeometry } from "@/lib/debug/calibration/xg-5b9-report";
export {
  CATALOGUE_CONSTANT_OFFSET,
  CATALOGUE_ELO_GAP_BUCKETS,
  CATALOGUE_GD_CLAMP,
  CATALOGUE_GD_COEFFICIENT,
  CATALOGUE_WIN_RATE_COEFFICIENT,
  PLAYED_BEFORE_BUCKETS,
  R0_AWAY_BASE,
  R0_HOME_BASE,
  R1_EQUAL_BASE,
} from "@/lib/debug/calibration/cat-5b10-shape";
export {
  PRODUCTION_CATALOGUE_ELO_AUDIT,
  assertComponentSum,
  assertMirrorsProductionCatalogue,
  catalogueEloFromParts,
  catalogueEloGapBucket,
  playedBeforeBucket,
} from "@/lib/debug/calibration/cat-5b10-formula";
export {
  decomposeMatchGap,
  evaluateSeasonCatalogueGeometry,
  sparseWinRateSynthetics,
} from "@/lib/debug/calibration/cat-5b10-evaluate";
export {
  evaluateRoleBaseCounterfactual,
  gdScaleDiagnostics,
} from "@/lib/debug/calibration/cat-5b10-counterfactual";
export { classifyCatalogueInput } from "@/lib/debug/calibration/cat-5b10-report";
export {
  GD_RATE_CLAMP,
  GD_RATE_COEFFICIENT,
  INPUT_GEOMETRY_ARMS,
  INPUT_GEOMETRY_EVIDENCE_SCOPES,
  INPUT_GEOMETRY_SHRINKAGE_K,
  NON_CANDIDATE_GD_RATE_LABEL,
  PE_HOME_ADVANTAGE_REMAINS,
  armSpec,
} from "@/lib/debug/calibration/ig-5b11-shape";
export {
  applyShrinkage,
  assertC0MirrorsCurrentCatalogue,
  assertC1OnlyEqualizesRoleBases,
  gdRateContribution,
  resolveInputGeometryElo,
  resolveMatchElos,
  unroundedCatalogueTarget,
} from "@/lib/debug/calibration/ig-5b11-formula";
export {
  evaluateSeasonInputGeometry,
  poolHoldoutOnly,
  subtractMetrics,
  summarizeArmTraces,
} from "@/lib/debug/calibration/ig-5b11-evaluate";
export { classifyInputGeometry } from "@/lib/debug/calibration/ig-5b11-report";
export {
  DECLARED_ELO_GOAL_SCALES,
  EFFECTIVE_GAP_CAP,
  GEOMETRY_ARMS,
  GEOMETRY_PANELS,
  P7_NON_CANDIDATE_LABEL,
  geometryArmSpec,
} from "@/lib/debug/calibration/xg-5b12-shape";
export {
  assertG0MirrorsProductionEngine,
  assertP0MirrorsC0,
  assertP7MirrorsC7,
  clampEffectiveGap,
  effectiveEloPair,
  panelMatchElos,
  predictDebugGeometry,
} from "@/lib/debug/calibration/xg-5b12-formula";
export {
  evaluatePanelSeason,
  poolHoldoutGeometry,
} from "@/lib/debug/calibration/xg-5b12-evaluate";
export { classifyXgGeometryCounterfactual } from "@/lib/debug/calibration/xg-5b12-report";
export {
  D1_NON_CANDIDATE_LABEL,
  DECLARED_BLEND_WEIGHTS,
  DECLARED_DC_RHOS,
  DECLARED_DRAW_BASE_DELTAS,
  DECLARED_HA_VALUES,
  DRAW_PANELS,
  drawProbBucket,
  eloGapDrawBucket,
  lambdaRatioDrawBucket,
  observedDrawScoreline,
  totalXgDrawBucket,
} from "@/lib/debug/calibration/draw-5b13-shape";
export {
  PRODUCTION_DRAW_PIPELINE_AUDIT,
  assertD0MirrorsProduction,
  assertD1MirrorsP7G0,
  assertHybridDrawDecomposition,
  assertRho0MirrorsIndependentPoisson,
  decomposeHybridDraw,
  panelDrawElos,
  predictBlendHybrid,
  predictDcHybrid,
  predictDrawBaseHybrid,
  predictHaHybrid,
  predictProductionDrawChain,
} from "@/lib/debug/calibration/draw-5b13-formula";
export {
  evaluateDrawPanelSeason,
  poolHoldoutDraw,
  residual2025,
} from "@/lib/debug/calibration/draw-5b13-evaluate";
export { classifyDrawChannelResidual } from "@/lib/debug/calibration/draw-5b13-report";
export {
  BOOTSTRAP_RESAMPLES,
  BOOTSTRAP_SEED,
  DECLARED_LAMBDA3,
  HS_PANELS,
  isHighEqual,
  isLowEqual,
  twoTwoRatioBucket,
  twoTwoXgBucket,
} from "@/lib/debug/calibration/hs-5b14-shape";
export {
  BIVARIATE_POISSON_EQUATIONS,
  assertLambda3ZeroMirrorsIndependent,
  bootstrapPearson,
  buildBivariateScoreGrid,
  buildIndependentScoreGrid,
  bivariateScorelineProbability,
  diagnosticLambdas,
  pearsonCorrelation,
  predictBivariateHybrid,
} from "@/lib/debug/calibration/hs-5b14-formula";
export {
  contrastDrawSeasons,
  evaluateHsPanelSeason,
  poolHoldoutHs,
} from "@/lib/debug/calibration/hs-5b14-evaluate";
export { classifyHigherScoreDraw } from "@/lib/debug/calibration/hs-5b14-report";
export {
  HALF_SIZE,
  HIGH_EQUAL_OE_THRESHOLD,
  QUARTILE_SIZE,
  SEASON_N,
  TR_BOOTSTRAP_RESAMPLES,
  TR_BOOTSTRAP_SEED,
  TR_PANELS,
  compareChronological,
  sortChronological,
  splitHalves,
  splitQuartiles,
} from "@/lib/debug/calibration/tr-5b15-shape";
export {
  bootstrapHighEqual,
  bootstrapResidual,
  highEqualExpected,
  isHighEqualTrace,
  isLowEqualTrace,
} from "@/lib/debug/calibration/tr-5b15-formula";
export {
  evaluateSeasonTemporal,
  leaveOneSeasonOut,
  poolCorrespondingWindows,
} from "@/lib/debug/calibration/tr-5b15-evaluate";
export { classifyTemporalRobustness } from "@/lib/debug/calibration/tr-5b15-report";
export {
  HIGH_EQUAL_MULTIPLIERS,
  LM_PANELS,
  LOCAL_MASS_ARMS,
  TRANSFER_HIGH_EQUAL_RELATIVE,
  isHighEqualCell,
  isLowEqualCell,
} from "@/lib/debug/calibration/lm-5b16-shape";
export {
  LOCAL_MASS_NORMALIZATION,
  applyHighEqualMultiplier,
  applyHighEqualTransfer,
  applyLocalMassArm,
  assertM0MirrorsIndependent,
  buildControlGrid,
  summarizeCells,
} from "@/lib/debug/calibration/lm-5b16-formula";
export {
  evaluateSeasonLocalMass,
  leaveOneSeasonOutLocal,
  poolHoldoutLocal,
} from "@/lib/debug/calibration/lm-5b16-evaluate";
export { classifyLocalMass } from "@/lib/debug/calibration/lm-5b16-report";
export {
  CANDIDATE_ARMS,
  CANDIDATE_MANIFEST,
  CANDIDATE_MANIFEST_FINGERPRINT,
  CONTROL_PRODUCTION_GEOMETRY,
  HIGH_EQUAL_SPECIAL_RULE,
  PRIMARY_PROSPECTIVE_METRICS,
  PROSPECTIVE_PROMOTION_RULES,
  SECONDARY_PROSPECTIVE_METRICS,
  assertExactlyFiveArms,
  candidateArm,
} from "@/lib/debug/calibration/prospective/candidate-config";
export {
  PRODUCTION_BASE_COMMIT,
  PROSPECTIVE_CANDIDATE_IDS,
  PROSPECTIVE_CANDIDATE_VERSION,
  PROSPECTIVE_CHECKPOINTS,
  USED_HISTORICAL_SEASONS,
} from "@/lib/debug/calibration/prospective/candidate-types";
export { resolveCandidateElos } from "@/lib/debug/calibration/prospective/candidate-input";
export { predictCandidate } from "@/lib/debug/calibration/prospective/candidate-engine";
export { capturePrediction, scorePredictionRecord } from "@/lib/debug/calibration/prospective/candidate-record";
export {
  HistoricalFirewallError,
  ProspectiveIntegrityError,
  assertNotHistoricalOutcomeDataset,
  assertNotUsedHistoricalSeason,
  sortDeterministic,
} from "@/lib/debug/calibration/prospective/candidate-integrity";
export { applyCandidateHighEqual } from "@/lib/debug/calibration/prospective/candidate-high-equal";
export {
  CAPTURE_WINDOW_PLACEHOLDER,
  FORBIDDEN_CAPTURE_INPUT_KEYS,
  PROSPECTIVE_DATA_DIR,
  PROSPECTIVE_PENDING_DIR,
  PROSPECTIVE_SCORED_DIR,
} from "@/lib/debug/calibration/prospective/capture/capture-types";
export { createFixedClock, createInjectedClock } from "@/lib/debug/calibration/prospective/capture/capture-clock";
export { captureProspectiveBatch } from "@/lib/debug/calibration/prospective/capture/capture-runner";
export {
  canonicalJson,
  deriveBatchId,
  hashEvidenceManifest,
  hashRecords,
  sha256Canonical,
} from "@/lib/debug/calibration/prospective/capture/capture-manifest";
export {
  findPriorFixtureCapture,
  loadPendingBatch,
  loadPriorCaptureIndex,
  persistPendingBatch,
} from "@/lib/debug/calibration/prospective/capture/capture-persist";
export { buildCaptureReport, formatCaptureReport } from "@/lib/debug/calibration/prospective/capture/capture-report";
export {
  assertCaptureBatchIntegrity,
  verifyBatchHashes,
} from "@/lib/debug/calibration/prospective/capture/capture-integrity";
export { createEvidenceSnapshot } from "@/lib/debug/calibration/prospective/capture/capture-evidence";
export {
  LIVE_CAPTURE_WINDOW,
  LIVE_PROTOCOL_API_BUDGET,
  LIVE_PROTOCOL_CONFIG,
  assertFiniteApiBudget,
  liveProtocolCaptureWindow,
} from "@/lib/debug/calibration/prospective/protocol/protocol-config";
export {
  LIVE_PROTOCOL_FINGERPRINT,
  assertProtocolFingerprintsDistinct,
  computeProtocolFingerprint,
  protocolCanonicalJson,
} from "@/lib/debug/calibration/prospective/protocol/protocol-fingerprint";
export {
  LIVE_PROTOCOL_BASE_COMMIT,
  LIVE_PROTOCOL_VERSION,
  OFFLINE_SYNTHETIC_SEASON,
  PLANNER_DISPOSITIONS,
  PROSPECTIVE_COMPETITION_ID,
  PROSPECTIVE_SEASON_UNVERIFIED,
  SAMPLE_DISPOSITIONS,
} from "@/lib/debug/calibration/prospective/protocol/protocol-types";
export { planDiscoveredFixtures, protocolDryRun } from "@/lib/debug/calibration/prospective/protocol/protocol-planner";
export { planFirstLiveDiscovery, FIRST_LIVE_PHASE } from "@/lib/debug/calibration/prospective/protocol/protocol-discovery";
export { countPrimarySampleN, reportingCheckpoints } from "@/lib/debug/calibration/prospective/protocol/protocol-sample";
export { isEligiblePriorEvidence, selectPriorEvidenceFixtures } from "@/lib/debug/calibration/prospective/protocol/protocol-evidence";
export { toUtcIso } from "@/lib/debug/calibration/prospective/protocol/protocol-utc";
export {
  DISCOVERY_CALL_BUDGET,
  assertDiscoveryBudget,
  emptyDiscoveryAccounting,
  noteFixtureDiscoveryCall,
} from "@/lib/debug/calibration/prospective/live/discovery-budget";
export {
  DISCOVERY_ALLOWED_PATH,
  DISCOVERY_DATA_DIR,
  DISCOVERY_FIXTURE_QUERY,
  DISCOVERY_FORBIDDEN_PATHS,
  DISCOVERY_PROVIDER,
  DiscoveryBudgetError,
  DiscoveryIntegrityError,
  SEASON_VERIFICATION_METHOD,
} from "@/lib/debug/calibration/prospective/live/discovery-types";
export {
  assertSafeProjectedObject,
  projectSafeFixture,
  projectSafeFixtures,
  verifySeasonFromProjected,
} from "@/lib/debug/calibration/prospective/live/discovery-projection";
export {
  captureOpportunitiesFrom,
  classifyProjectedFixtures,
} from "@/lib/debug/calibration/prospective/live/discovery-classify";
export {
  assertAllowedDiscoveryRequest,
  assertOddsUnavailable,
  createLiveDiscoveryTransport,
} from "@/lib/debug/calibration/prospective/live/discovery-transport";
export { persistDiscoveryArtifact } from "@/lib/debug/calibration/prospective/live/discovery-persist";
export { discoverLiveFixtures } from "@/lib/debug/calibration/prospective/live/discovery-runner";

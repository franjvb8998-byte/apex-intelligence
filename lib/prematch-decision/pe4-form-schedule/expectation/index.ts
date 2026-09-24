/**
 * PE-4G.3 — Offline expectation dataset builder exports.
 */

export {
  PE4_EXPECTATION_COMMON_BASELINE,
  PE4_EXPECTATION_DATASET_BUILDER_VERSION,
  PE4_EXPECTATION_DATASET_SCHEMA_VERSION,
  type Pe4ExpectationActualOutcome,
  type Pe4ExpectationDatasetManifest,
  type Pe4ExpectationDatasetRow,
  type Pe4ExpectationDatasetSplitName,
  type Pe4ExpectationQualityKind,
  type Pe4ExpectationSplitManifest,
  type Pe4ExpectationStrengthSource,
} from "@/lib/prematch-decision/pe4-form-schedule/expectation/dataset-types";

export {
  pe4ExpectationQualityKind,
  reconstructPe4CommonBaselineStrength,
} from "@/lib/prematch-decision/pe4-form-schedule/expectation/common-strength";

export {
  buildPe4ExpectationDatasetRow,
  comparePe4ExpectationRows,
  pe4ExpectationCanonicalKey,
  type BuildPe4ExpectationRowResult,
} from "@/lib/prematch-decision/pe4-form-schedule/expectation/build-row";

export {
  buildPe4ExpectationDataset,
  type BuildPe4ExpectationDatasetInput,
  type BuildPe4ExpectationDatasetResult,
} from "@/lib/prematch-decision/pe4-form-schedule/expectation/build-dataset";

export {
  digestPe4ExpectationDataset,
  digestPe4ExpectationFixtureIds,
  PE4_EXPECTATION_DATASET_DIGEST_VERSION,
} from "@/lib/prematch-decision/pe4-form-schedule/expectation/digest";

export {
  describePe4ExpectationDataset,
  PE4_EXPECTATION_DIAGNOSTIC_D_RANGES,
} from "@/lib/prematch-decision/pe4-form-schedule/expectation/descriptive";

export {
  assignPe4ExpectationSplitName,
  buildPe4ExpectationSplitManifests,
  PE4_EXPECTATION_DEFAULT_SEASON_SPLITS,
  PE4_EXPECTATION_ROLLING_ORIGIN_PLAN,
} from "@/lib/prematch-decision/pe4-form-schedule/expectation/splits";

export {
  buildFinalFixtureEvidence,
  observationFromApexBundle,
  observationFromVisionTerminal,
} from "@/lib/final-evidence/capture";
export {
  classifyVendorFinalization,
  isNonScoreableTerminalStatus,
  isPersistableFinalStatus,
  isScoreableFinalStatus,
  isValidGoalCount,
  NON_SCOREABLE_TERMINAL_STATUSES,
  SCOREABLE_FINAL_STATUSES,
} from "@/lib/final-evidence/finalization";
export { finalFixtureEvidenceId } from "@/lib/final-evidence/identity";
export {
  cloneFinalFixtureEvidence,
  materialFinalEvidenceKey,
  serializeFinalFixtureEvidence,
} from "@/lib/final-evidence/serialize";
export {
  InMemoryFinalFixtureEvidenceBackend,
  InMemoryFinalFixtureEvidenceStore,
  LayeredFinalFixtureEvidenceStore,
  UnavailableFinalFixtureEvidenceBackend,
  getFinalFixtureEvidenceStore,
  resetFinalFixtureEvidenceStoreForTests,
  setFinalFixtureEvidenceDurableBackendFactory,
  type FinalEvidenceInsertResult,
  type FinalFixtureEvidenceDurableBackend,
  type FinalFixtureEvidenceStore,
} from "@/lib/final-evidence/store";
export {
  FINAL_FIXTURE_EVIDENCE_ID_PREFIX,
  FINAL_FIXTURE_EVIDENCE_SCHEMA_VERSION,
  type FinalEvidenceSource,
  type FinalFixtureEvidence,
  type FinalFixtureObservation,
  type FinalizationClass,
  type ObserveFinalEvidenceResult,
} from "@/lib/final-evidence/types";

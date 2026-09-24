/**
 * PE-4F — Cross-competition team schedule (offline foundation).
 */

export type {
  Pe4CompetitionLoadClass,
  Pe4CrossCompScheduleSideEvidence,
  Pe4TeamScheduleAcquireErr,
  Pe4TeamScheduleAcquireKey,
  Pe4TeamScheduleAcquireOk,
  Pe4TeamScheduleAcquireResult,
  Pe4TeamScheduleAcquisitionScope,
  Pe4TeamScheduleFixture,
  Pe4TeamScheduleProviderEnvelope,
} from "@/lib/prematch-decision/pe4-form-schedule/schedule/types";

export { evaluatePe4TeamScheduleProviderEnvelope } from "@/lib/prematch-decision/pe4-form-schedule/schedule/envelope";
export {
  classifyPe4CompetitionLoad,
  pe4LoadClassCountsTowardSemanticSchedule,
} from "@/lib/prematch-decision/pe4-form-schedule/schedule/competition-policy";
export {
  normalizePe4TeamScheduleFixtures,
  type NormalizeTeamScheduleResult,
} from "@/lib/prematch-decision/pe4-form-schedule/schedule/normalize";
export {
  createRunScopedPe4TeamScheduleCache,
  pe4TeamScheduleCacheKey,
  type Pe4TeamScheduleLoader,
  type RunScopedPe4TeamScheduleCache,
} from "@/lib/prematch-decision/pe4-form-schedule/schedule/cache";
export {
  acquirePe4TeamSchedule,
  type AcquirePe4TeamScheduleInput,
} from "@/lib/prematch-decision/pe4-form-schedule/schedule/acquire";
export {
  extractPe4CrossCompScheduleSide,
  pe4CongestionWindowBounds,
  requestedWindowCoversCongestionInterval,
  type ExtractPe4CrossCompScheduleSideInput,
} from "@/lib/prematch-decision/pe4-form-schedule/schedule/extract-schedule";
export {
  digestPe4CrossCompScheduleSide,
  PE4_TEAM_SCHEDULE_EVIDENCE_DIGEST_VERSION,
} from "@/lib/prematch-decision/pe4-form-schedule/schedule/digest";
export {
  buildPe4CrossCompScheduleProvenanceFragment,
  mergePe4CompetitionScopedWithCrossCompSchedule,
  PE4_COMPETITION_SCOPED_SCHEDULE_SOURCE,
  PE4_CROSS_COMP_SCHEDULE_SOURCE,
  type Pe4CrossCompScheduleProvenanceFragment,
  type Pe4MergedFormScheduleEvidence,
  type Pe4ScheduleEvidenceSource,
} from "@/lib/prematch-decision/pe4-form-schedule/schedule/merge";

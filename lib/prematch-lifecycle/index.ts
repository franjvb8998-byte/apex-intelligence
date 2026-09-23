export {
  authorizePrematchLifecycleRequest,
  presentedBearerSecret,
  timingSafeSecretEqual,
} from "@/lib/prematch-lifecycle/auth";
export {
  DEFAULT_MAX_NEW_TICKETS_PER_RUN,
  LIFECYCLE_CRON_SECRET_ENV,
  LIFECYCLE_LEAGUE_IDS_ENV,
  LIFECYCLE_MAX_NEW_TICKETS_ENV,
  MAX_IDS_RECONCILE_PER_RUN,
  MAX_NEW_TICKETS_PER_RUN_CEILING,
  MAX_TICKET_LIST_PAGES_PER_RUN,
  PENDING_TICKET_EPOCH_UTC,
  TICKET_LIST_PAGE_SIZE,
  isNumericLifecycleFixtureId,
  parseLifecycleLeagueIds,
  parseMaxNewTicketsPerRun,
  readPrematchLifecycleConfig,
  readPrematchLifecycleCronSecret,
  type LifecycleLeagueAllowlist,
  type PrematchLifecycleConfig,
} from "@/lib/prematch-lifecycle/config";
export {
  runPrematchLifecycle,
  type PrematchLifecycleDependencies,
} from "@/lib/prematch-lifecycle/coordinator";
export type { PrematchLifecycleReport } from "@/lib/prematch-lifecycle/report";
export {
  RUNNER_EXIT,
  executePrematchLifecycleRunner,
  sanitizePrematchLifecycleReport,
  validatePrematchLifecycleRunnerEnv,
  type PrematchLifecycleRunnerDeps,
  type PrematchLifecycleSanitizedSummary,
} from "@/lib/prematch-lifecycle/runner";
export {
  PE3C_C0_RECON_ACTIVATION,
  isC0ReconLifecycleActivated,
  resolveLifecyclePeInputMode,
  type LifecyclePeInputMode,
} from "@/lib/prematch-lifecycle/pe3-activation";
export {
  MANUAL_C0_CONFIRM_FLAG,
  MANUAL_C0_ENABLE_FLAG,
  MANUAL_C0_SMOKE_MAX_NEW_TICKETS,
  isManualC0SmokeArgv,
  parseManualC0SmokeArgv,
  type ManualC0SmokeControls,
} from "@/lib/prematch-lifecycle/pe3-controlled-activation";
export {
  PE3_C0_ACCEPTANCE_MODEL_VERSION,
  evaluatePe3C0LiveAcceptance,
  type Pe3C0AcceptanceResult,
} from "@/lib/prematch-lifecycle/c0-live-acceptance";
export {
  parseC0AcceptanceArgv,
  runPe3C0AcceptanceVerification,
} from "@/lib/prematch-lifecycle/c0-live-acceptance-cli";

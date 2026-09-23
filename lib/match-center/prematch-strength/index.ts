export {
  CATALOGUE_ELO_CONSTANT_OFFSET,
  CATALOGUE_ELO_GD_CLAMP,
  CATALOGUE_ELO_GD_COEFFICIENT,
  CATALOGUE_ELO_WIN_RATE_COEFFICIENT,
  PRODUCTION_AWAY_ELO_BASE,
  PRODUCTION_HOME_ELO_BASE,
  catalogueEloFromPlayedStats,
} from "@/lib/match-center/catalogue-elo";

export { isCompletedPrematchEvidenceStatus } from "@/lib/match-center/prematch-strength/completed-status";

export {
  dedupeUniverseByFixtureId,
  isEligiblePriorKickoff,
  isValidPrematchStrengthTarget,
  parseKickoffUtcMillis,
  reconstructPrematchTeamEvidence,
  universeEvidenceIdentityKey,
  type DedupeUniverseResult,
  type ReconstructedPrematchEvidence,
} from "@/lib/match-center/prematch-strength/reconstruct-evidence";

export {
  PrematchUniverseConflictError,
  resolvePrematchStrengthFromUniverse,
} from "@/lib/match-center/prematch-strength/resolve-prematch-strength";

export {
  PREMATCH_ACCEPTED_EVIDENCE_DIGEST_VERSION,
  digestAcceptedPrematchEvidence,
} from "@/lib/match-center/prematch-strength/evidence-digest";

export {
  PREMATCH_STRENGTH_REGIME_C0_RECON_V1,
  type PrematchSideStrength,
  type PrematchStrengthEloSource,
  type PrematchStrengthFallbackReason,
  type PrematchStrengthRegime,
  type PrematchStrengthResult,
  type PrematchStrengthTarget,
  type PrematchStrengthUniverseFixture,
  type PrematchTeamEvidenceCounts,
} from "@/lib/match-center/prematch-strength/types";

/**
 * APEX Team Intelligence Engine — club digital twin.
 *
 * Consume from any module:
 *   import { evaluateTeamIntelligence } from "@/lib/team-intelligence";
 *
 * Does not fetch HTTP, does not re-score the Decision Engine, and does not invent
 * unpublished facts (travel, derbies, market value, set pieces, PPDA).
 */

export type {
  AbsenceFeed,
  AbsenceItem,
  BudgetTier,
  ClubSize,
  FormLetter,
  MomentumTrend,
  PerformanceDirection,
  PlayingStyleLabel,
  PublishedMetric,
  PublishedScore,
  RecentMatchFact,
  StyleAxes,
  TeamIntelligenceInput,
  TournamentPriority,
  TransferFeed,
  VenueRecord,
} from "@/lib/team-intelligence/types";

export type {
  CurrentFormLayer,
  EnvironmentLayer,
  MomentumLayer,
  MotivationLayer,
  ScheduleLayer,
  SquadHealthLayer,
  TacticalDnaLayer,
  TeamIdentityLayer,
  TeamIntelligence,
  TeamIntelligencePillar,
  TeamIntelligencePillarKey,
  TeamIntelligenceScores,
  TransferIntelligenceLayer,
  VenueDnaLayer,
} from "@/lib/team-intelligence/models";

export {
  TEAM_INTELLIGENCE_PILLAR_LABELS,
  TEAM_INTELLIGENCE_WEIGHTS,
} from "@/lib/team-intelligence/weights";

export {
  clamp,
  coverageBlend,
  formLettersFrom,
  formQuality,
  metric,
  roundScore,
  score,
} from "@/lib/team-intelligence/normalizers";

export {
  awayLayer,
  clubSizeFromCapacity,
  environmentLayer,
  formLayer,
  healthLayer,
  homeLayer,
  identityLayer,
  momentumLayer,
  motivationLayer,
  parseStandingDescription,
  playingStyleFrom,
  scheduleLayer,
  tacticalLayer,
  transferLayer,
} from "@/lib/team-intelligence/calculators";

export { buildTeamIntelligenceScores } from "@/lib/team-intelligence/scores";

export {
  EMPTY_TEAM_INTELLIGENCE_TRANSFERS,
  emptyTeamIntelligenceInput,
  clubTwinsFromPreview,
  selectionTwinFromPreview,
  teamIntelligenceInputFromMatchCenter,
  type MatchCenterTeamIntelligenceSource,
} from "@/lib/team-intelligence/builders";

export {
  createTeamIntelligenceEngine,
  evaluateMatchClubTwins,
  evaluateTeamIntelligence,
  type TeamIntelligenceEnginePort,
} from "@/lib/team-intelligence/engine";

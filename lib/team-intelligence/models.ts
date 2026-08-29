/**
 * Digital twin document — the object every APEX module can consume.
 */

import type {
  BudgetTier,
  ClubSize,
  FormLetter,
  MomentumTrend,
  PerformanceDirection,
  PlayingStyleLabel,
  PublishedMetric,
  PublishedScore,
  TournamentPriority,
} from "@/lib/team-intelligence/types";

export type TeamIntelligencePillarKey =
  | "attack"
  | "defense"
  | "momentum"
  | "health"
  | "tacticalIdentity"
  | "motivation"
  | "transferStability"
  | "home"
  | "away";

export type TeamIntelligencePillar = {
  key: TeamIntelligencePillarKey;
  label: string;
  weight: number;
  score: number | null;
  available: boolean;
  note: string;
};

export type TeamIdentityLayer = {
  clubName: string;
  country: string | null;
  league: string | null;
  season: string | null;
  manager: string | null;
  formation: string | null;
  playingStyle: PlayingStyleLabel | null;
  budgetTier: BudgetTier | null;
  clubSize: ClubSize | null;
  averageSquadAge: number | null;
  marketValue: number | null;
};

export type TacticalDnaLayer = {
  attackingStrength: PublishedScore;
  defensiveStrength: PublishedScore;
  possessionStyle: PublishedScore;
  pressingIntensity: PublishedScore;
  counterAttackRating: PublishedScore;
  setPieceRating: PublishedScore;
  crossingFrequency: PublishedScore;
  longBallUsage: PublishedScore;
  highLine: PublishedScore;
  compactness: PublishedScore;
  tempo: PublishedScore;
  width: PublishedScore;
};

export type CurrentFormLayer = {
  last5: FormLetter[];
  last10: FormLetter[];
  last5Quality: PublishedScore;
  last10Quality: PublishedScore;
  goalsScored: PublishedMetric<number>;
  goalsConceded: PublishedMetric<number>;
  expectedGoals: PublishedMetric<number>;
  expectedGoalsAgainst: PublishedMetric<number>;
  cleanSheets: PublishedMetric<number>;
  bttsFrequency: PublishedMetric<number>;
  over25Frequency: PublishedMetric<number>;
  corners: PublishedMetric<number>;
  cards: PublishedMetric<number>;
};

export type VenueDnaLayer = {
  strength: PublishedScore;
  goals: PublishedMetric<number>;
  expectedGoals: PublishedMetric<number>;
  winRate: PublishedMetric<number>;
};

export type MomentumLayer = {
  current: PublishedScore;
  trend: PublishedMetric<MomentumTrend>;
  confidence: PublishedScore;
  performanceDirection: PublishedMetric<PerformanceDirection>;
};

export type SquadHealthLayer = {
  availablePlayers: PublishedMetric<number>;
  injuries: PublishedMetric<number>;
  suspensions: PublishedMetric<number>;
  fatigue: PublishedScore;
  rotationRisk: PublishedScore;
  benchQuality: PublishedScore;
  squadDepth: PublishedScore;
};

export type TransferIntelligenceLayer = {
  incomingTransfers: PublishedMetric<number>;
  outgoingTransfers: PublishedMetric<number>;
  estimatedImpact: PublishedMetric<number>;
  netSquadImprovement: PublishedMetric<number>;
  youthPromotions: PublishedMetric<number>;
  managerChanges: PublishedMetric<boolean>;
};

export type MotivationLayer = {
  leaguePosition: PublishedMetric<number>;
  titleRace: PublishedMetric<boolean>;
  europeanQualification: PublishedMetric<boolean>;
  relegationRisk: PublishedMetric<boolean>;
  derby: PublishedMetric<boolean>;
  rivalry: PublishedMetric<boolean>;
  tournamentPriority: PublishedMetric<TournamentPriority>;
};

export type ScheduleLayer = {
  restDays: PublishedMetric<number>;
  travelDistance: PublishedMetric<number>;
  matchesInLast14Days: PublishedMetric<number>;
  upcomingImportantMatch: PublishedMetric<boolean>;
  fixtureCongestion: PublishedMetric<boolean>;
};

export type EnvironmentLayer = {
  weatherSensitivity: PublishedScore;
  weather: PublishedMetric<string>;
  altitudeExperience: PublishedScore;
  altitudeMeters: PublishedMetric<number>;
  artificialTurfExperience: PublishedScore;
  artificialTurf: PublishedMetric<boolean>;
  refereeCompatibility: PublishedScore;
  refereeName: PublishedMetric<string>;
};

export type TeamIntelligenceScores = {
  overall: number;
  coverage: number;
  attack: PublishedScore;
  defense: PublishedScore;
  momentum: PublishedScore;
  health: PublishedScore;
  tacticalIdentity: PublishedScore;
  motivation: PublishedScore;
  transferStability: PublishedScore;
  home: PublishedScore;
  away: PublishedScore;
  pillars: TeamIntelligencePillar[];
};

/**
 * Club digital twin. Deterministic. Coverage drops unpublished layers.
 */
export type TeamIntelligence = {
  engineId: "team-intelligence-v1";
  teamId: string;
  asOf: string;
  identity: TeamIdentityLayer;
  tactical: TacticalDnaLayer;
  form: CurrentFormLayer;
  home: VenueDnaLayer;
  away: VenueDnaLayer;
  momentum: MomentumLayer;
  health: SquadHealthLayer;
  transfers: TransferIntelligenceLayer;
  motivation: MotivationLayer;
  schedule: ScheduleLayer;
  environment: EnvironmentLayer;
  scores: TeamIntelligenceScores;
  reasons: string[];
};

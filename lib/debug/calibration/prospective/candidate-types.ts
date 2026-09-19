/**
 * 5C.1 prospective candidate types. Debug-only. Not a production policy.
 */

export const PROSPECTIVE_CANDIDATE_VERSION = "apex.calibration.prospective.5c1.v1";

export const PRODUCTION_BASE_COMMIT =
  "967b541f3947a4f9cfe0d1fe5eea57f3de880f62";

export const PROSPECTIVE_CANDIDATE_IDS = [
  "CONTROL_PRODUCTION",
  "CANDIDATE_A_INPUT",
  "CANDIDATE_B_TRANSFORM",
  "CANDIDATE_C_COMBINED",
  "CANDIDATE_D_COMBINED_HIGH_EQUAL",
] as const;
export type ProspectiveCandidateId = (typeof PROSPECTIVE_CANDIDATE_IDS)[number];

export const INPUT_POLICIES = ["PRODUCTION_C0", "C7_EQUAL_BASE_SHRINKAGE_GD_RATE"] as const;
export type InputPolicy = (typeof INPUT_POLICIES)[number];

export const HIGH_EQUAL_POLICIES = ["NONE", "T1_PLUS_10_PERCENT_FROM_NON_DRAW"] as const;
export type HighEqualPolicy = (typeof HIGH_EQUAL_POLICIES)[number];

export const RESULT_STATUSES = ["PENDING", "FINAL", "VOID"] as const;
export type ResultStatus = (typeof RESULT_STATUSES)[number];

export const USED_HISTORICAL_SEASONS = ["2023", "2024", "2025"] as const;

export const PROSPECTIVE_CHECKPOINTS = [100, 250, 500] as const;

export type ProspectiveEvidence = {
  fixtureId: string;
  competitionId: string;
  season: string;
  kickoff: string;
  homeTeamId: string;
  awayTeamId: string;
  homePlayedBefore: number;
  homeWinsBefore: number;
  homeGfBefore: number;
  homeGaBefore: number;
  awayPlayedBefore: number;
  awayWinsBefore: number;
  awayGfBefore: number;
  awayGaBefore: number;
  evidenceAsOf: string;
};

export type ProspectiveOdds = {
  home: number;
  draw: number;
  away: number;
};

export type MarketImpliedProbabilities = {
  home: number;
  draw: number;
  away: number;
};

export type CandidateArmSpec = {
  candidateId: ProspectiveCandidateId;
  candidateVersion: string;
  description: string;
  inputPolicy: InputPolicy;
  eloGoalScale: number;
  highEqualPolicy: HighEqualPolicy;
  productionBaseCommit: string;
};

export type ProspectivePredictionRecord = {
  fixtureId: string;
  competitionId: string;
  season: string;
  kickoff: string;
  capturedAt: string;
  modelVersion: string;
  candidateId: ProspectiveCandidateId;
  candidateVersion: string;
  candidateFingerprint: string;
  inputEvidenceCounts: {
    homePlayedBefore: number;
    awayPlayedBefore: number;
  };
  homeElo: number;
  awayElo: number;
  eloGap: number;
  lambdaHome: number;
  lambdaAway: number;
  probHome: number;
  probDraw: number;
  probAway: number;
  confidence: number;
  odds: ProspectiveOdds | null;
  marketImpliedProbabilities: MarketImpliedProbabilities | null;
  resultStatus: ResultStatus;
  finalHomeGoals: number | null;
  finalAwayGoals: number | null;
  scoredAt: string | null;
};

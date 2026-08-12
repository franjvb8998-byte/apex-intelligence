import type {
  LearningSignal,
  MatchContext,
  SystemPrediction,
  UUID,
  UserPrediction,
} from "@/lib/intelligence/types";

/**
 * Ports toward Supabase / external stores.
 * Keep auth out of the Intelligence Core — only domain I/O.
 */
export interface MatchContextRepository {
  getByMatchId(matchId: UUID): Promise<MatchContext | null>;
  listUpcoming(limit?: number): Promise<MatchContext[]>;
}

export interface PredictionRepository {
  save(prediction: SystemPrediction): Promise<SystemPrediction>;
  getLatestForMatch(matchId: UUID): Promise<SystemPrediction | null>;
  listForMatches(matchIds: UUID[]): Promise<SystemPrediction[]>;
}

export interface UserPredictionRepository {
  listForUser(userId: UUID): Promise<UserPrediction[]>;
  getForUserAndMatch(
    userId: UUID,
    matchId: UUID,
  ): Promise<UserPrediction | null>;
}

export interface LearningRepository {
  saveSignals(signals: LearningSignal[]): Promise<void>;
}

import type {
  LearningRepository,
  MatchContextRepository,
  PredictionRepository,
  UserPredictionRepository,
} from "@/lib/intelligence/contracts";
import type {
  LearningSignal,
  MatchContext,
  SystemPrediction,
  UUID,
  UserPrediction,
} from "@/lib/intelligence/types";

/**
 * Supabase adapters for the Intelligence Core.
 * These ports map domain types ↔ tables (matches, predictions, etc.).
 * Auth/session handling stays outside this package (lib/supabase/*).
 *
 * Implementations intentionally throw until schema I/O is wired.
 */

export class SupabaseMatchContextRepository implements MatchContextRepository {
  async getByMatchId(_matchId: UUID): Promise<MatchContext | null> {
    throw new Error(
      "SupabaseMatchContextRepository.getByMatchId is not implemented",
    );
  }

  async listUpcoming(_limit?: number): Promise<MatchContext[]> {
    throw new Error(
      "SupabaseMatchContextRepository.listUpcoming is not implemented",
    );
  }
}

export class SupabasePredictionRepository implements PredictionRepository {
  async save(_prediction: SystemPrediction): Promise<SystemPrediction> {
    throw new Error("SupabasePredictionRepository.save is not implemented");
  }

  async getLatestForMatch(_matchId: UUID): Promise<SystemPrediction | null> {
    throw new Error(
      "SupabasePredictionRepository.getLatestForMatch is not implemented",
    );
  }

  async listForMatches(_matchIds: UUID[]): Promise<SystemPrediction[]> {
    throw new Error(
      "SupabasePredictionRepository.listForMatches is not implemented",
    );
  }
}

export class SupabaseUserPredictionRepository
  implements UserPredictionRepository
{
  async listForUser(_userId: UUID): Promise<UserPrediction[]> {
    throw new Error(
      "SupabaseUserPredictionRepository.listForUser is not implemented",
    );
  }

  async getForUserAndMatch(
    _userId: UUID,
    _matchId: UUID,
  ): Promise<UserPrediction | null> {
    throw new Error(
      "SupabaseUserPredictionRepository.getForUserAndMatch is not implemented",
    );
  }
}

export class SupabaseLearningRepository implements LearningRepository {
  async saveSignals(_signals: LearningSignal[]): Promise<void> {
    throw new Error("SupabaseLearningRepository.saveSignals is not implemented");
  }
}

export function createSupabaseIntelligenceAdapters() {
  return {
    matchContexts: new SupabaseMatchContextRepository(),
    predictions: new SupabasePredictionRepository(),
    userPredictions: new SupabaseUserPredictionRepository(),
    learning: new SupabaseLearningRepository(),
  };
}

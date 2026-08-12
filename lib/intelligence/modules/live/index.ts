import type { LiveModule } from "@/lib/intelligence/contracts";
import type {
  LiveMatchEvent,
  LivePredictionUpdate,
  SystemPrediction,
  UUID,
} from "@/lib/intelligence/types";

/**
 * Stub — in-play updates.
 */
export class LiveService implements LiveModule {
  async applyEvent(
    _current: SystemPrediction,
    _event: LiveMatchEvent,
  ): Promise<LivePredictionUpdate | null> {
    throw new Error("LiveService.applyEvent is not implemented");
  }

  shouldTrack(_matchId: UUID, _status: string): boolean {
    throw new Error("LiveService.shouldTrack is not implemented");
  }
}

export function createLiveModule(): LiveModule {
  return new LiveService();
}

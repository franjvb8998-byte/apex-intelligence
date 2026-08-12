import type {
  LiveMatchEvent,
  LivePredictionUpdate,
  SystemPrediction,
  UUID,
} from "@/lib/intelligence/types";

/**
 * Live module — in-play events and incremental prediction updates.
 * Algorithms intentionally unimplemented.
 */
export interface LiveModule {
  /** Apply a stream event and optionally emit an updated prediction snapshot. */
  applyEvent(
    current: SystemPrediction,
    event: LiveMatchEvent,
  ): Promise<LivePredictionUpdate | null>;

  /** Whether the match should be tracked by the live loop. */
  shouldTrack(matchId: UUID, status: string): boolean;
}

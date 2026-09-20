export {
  LIVE_TRANSPORT_SOURCE,
  type LiveEventClass,
  type LiveEventsSource,
  type LiveFixtureEvent,
  type LiveFixtureState,
  type LiveTransportSnapshot,
  type LiveTransportSource,
} from "@/lib/apex-vision/live/types";

export {
  classifyLiveStatus,
  isLiveStatus,
  isHalftimeStatus,
  isTerminalStatus,
  shouldKeepLiveTracking,
  type LiveStatusKind,
} from "@/lib/apex-vision/live/status";

export {
  classifyProviderEventClass,
  normalizeLiveEvent,
  normalizeLiveFixture,
  scoringGoalCount,
  scoreTotal,
} from "@/lib/apex-vision/live/normalize";

export {
  evaluateDedicatedEventsFallback,
  createDedicatedEventsFallbackGuard,
  type LiveFallbackDecision,
  type LiveFallbackReason,
  type DedicatedEventsFallbackGuard,
} from "@/lib/apex-vision/live/fallback";

export {
  createProcessLiveStore,
  type LiveStore,
} from "@/lib/apex-vision/live/store";

export {
  createVisionLiveTransport,
  DEFAULT_LIVE_FALLBACK_COOLDOWN_MS,
  DEFAULT_MAX_FALLBACK_CALLS_PER_REFRESH,
  type VisionLiveClient,
  type VisionLiveTransport,
  type VisionLiveTransportOptions,
} from "@/lib/apex-vision/live/service";

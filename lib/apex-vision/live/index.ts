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
  liveStatusCopyKey,
  isOrdinaryScheduledStatus,
  type LiveStatusKind,
  type LiveStatusCopyKey,
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

export {
  createVisionLiveCoordinator,
  getVisionLiveCoordinator,
  resetVisionLiveCoordinatorForTests,
  setVisionLiveCoordinatorForTests,
  type VisionLiveCoordinator,
  type VisionLiveCoordinatorOptions,
} from "@/lib/apex-vision/live/coordinator";

export { parseTrackedFixtureId } from "@/lib/apex-vision/live/parse-id";

export {
  LIVE_REFRESH_INTERVAL_MS,
  HT_REFRESH_INTERVAL_MS,
  LIVE_FRESHNESS_WINDOW_MS,
  MATCH_CENTER_LIVE_API_PATH,
  matchCenterLiveApiHref,
  shouldStartMatchCenterLivePoll,
  matchCenterLivePollIntervalMs,
  classifyLiveFreshness,
  toMatchCenterLiveView,
  unavailableLiveView,
  heuristicFromScore,
  cardToneFromDetail,
  type LiveFreshness,
  type LiveRefreshSource,
  type MatchCenterLiveView,
  type MatchCenterLiveViewEvent,
} from "@/lib/apex-vision/live/view";

/**
 * APEX Design System — reusable presentational components.
 * No business logic. No API calls.
 */

export { apexTokens, type ApexTone, type ApexSize } from "@/components/design-system/tokens";
export { cx, clamp01, toPercent } from "@/components/design-system/utils";

export { Card, CardHeader } from "@/components/design-system/card";
export { Badge } from "@/components/design-system/badge";
export { MarketChip } from "@/components/design-system/market-chip";
export {
  ProbabilityBars,
  type ProbabilityBarItem,
} from "@/components/design-system/probability-bars";
export {
  ConfidenceIndicator,
  resolveConfidenceBand,
  type ConfidenceBand,
} from "@/components/design-system/confidence-indicator";
export { ScoreGauge } from "@/components/design-system/score-gauge";
export { Timeline, type TimelineItem } from "@/components/design-system/timeline";
export { HeatmapPlaceholder } from "@/components/design-system/heatmap-placeholder";
export { ExplanationPanel } from "@/components/design-system/explanation-panel";
export {
  TeamLogo,
  teamLogoSrc,
  type TeamLogoSize,
} from "@/components/design-system/team-logo";

export type {
  ClassifiedBet,
  ExposureSlice,
  PortfolioHealth,
  PortfolioHealthBand,
  PortfolioInsight,
  PortfolioKpis,
  PortfolioRecommendation,
  PortfolioRecommendationKind,
  PortfolioReport,
} from "@/lib/portfolio/types";

export { classifyBet, classifyBets, parseMatchSides } from "@/lib/portfolio/classify";
export { buildPortfolioReport } from "@/lib/portfolio/build";
export {
  buildKpis,
  diversificationFromShares,
  exposureBuckets,
  healthBand,
  herfindahl,
  hitRateByMarket,
} from "@/lib/portfolio/metrics";
export { buildInsights, buildRecommendations } from "@/lib/portfolio/insights";

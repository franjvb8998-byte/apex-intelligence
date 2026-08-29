export type {
  ApexIntelligenceReport,
  ApexMarketFlags,
  ApexReportBreakdownBar,
  ApexReportBreakdownKey,
  ApexReportMarket,
  ApexReportReason,
  ApexReportRisk,
  ApexReasonId,
  ApexRiskId,
  ApexStakeKind,
  ApexVerdictKind,
} from "@/lib/intelligence-report/types";

export { buildIntelligenceReport } from "@/lib/intelligence-report/build-report";
export type { BuildIntelligenceReportInput } from "@/lib/intelligence-report/build-report";
export { buildReportFacts } from "@/lib/intelligence-report/facts";
export { buildReportReasons } from "@/lib/intelligence-report/reasons";
export { buildReportRisks } from "@/lib/intelligence-report/risks";
export {
  adjustConfidence,
  decideRecommendation,
  decideVerdict,
  snapExposure,
  EXPOSURE_STEPS,
} from "@/lib/intelligence-report/verdict";
export { buildNarrative } from "@/lib/intelligence-report/narrative";
export { buildBreakdown, disciplineScore } from "@/lib/intelligence-report/breakdown";

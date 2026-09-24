/**
 * GOALS-1B — Offline historical goal evidence (debug calibration only).
 */

export * from "@/lib/debug/calibration/goals/types";
export * from "@/lib/debug/calibration/goals/regulation";
export * from "@/lib/debug/calibration/goals/normalize";
export * from "@/lib/debug/calibration/goals/history";
export * from "@/lib/debug/calibration/goals/digest";
export * from "@/lib/debug/calibration/goals/build-evidence";
export * from "@/lib/debug/calibration/goals/build-dataset";
export * from "@/lib/debug/calibration/goals/fail-closed";
export * from "@/lib/debug/calibration/goals/g0";
export * from "@/lib/debug/calibration/goals/g1";
export * from "@/lib/debug/calibration/goals/g3";
export * from "@/lib/debug/calibration/goals/distributional-audit";
export * from "@/lib/debug/calibration/goals/market-calibration";
// GOALS-1G.2 POC — selective re-exports (avoid clipLogitP/logit collision with G1.1)
export {
  digestGoalsMcalPocProtocol,
  goalsMcalPocProtocol,
  GOALS_MCAL_POC_PROTOCOL_VERSION,
  GOALS_MCAL_POC_PARENT_G1_K,
  GOALS_MCAL_POC_REQUIRED_EVIDENCE_DIGEST,
} from "@/lib/debug/calibration/goals/market-calibration-poc/protocol";
export { runGoalsMarketCalibrationPoc } from "@/lib/debug/calibration/goals/market-calibration-poc/evaluate";
export {
  calibrateGoalsMarketProbabilities,
  GOALS_MCAL_POC_PRODUCTION_WIRED,
} from "@/lib/debug/calibration/goals/market-calibration-poc/adapter";
export {
  digestGoalsMcalRefProtocol,
  goalsMcalRefProtocol,
  GOALS_MCAL_REF_PROTOCOL_VERSION,
  GOALS_MCAL_REF_PARENT_G1_K,
} from "@/lib/debug/calibration/goals/market-calibration-refinement/protocol";
export { runGoalsMarketCalibrationRefinement } from "@/lib/debug/calibration/goals/market-calibration-refinement/evaluate";
export {
  calibrateMatchTotalRefinement,
  GOALS_MCAL_REF_PRODUCTION_WIRED,
} from "@/lib/debug/calibration/goals/market-calibration-refinement/adapter";
export {
  digestGoalsRadProtocol,
  goalsRadProtocol,
  GOALS_RAD_PROTOCOL_VERSION,
  GOALS_RAD_PARENT_G1_K,
} from "@/lib/debug/calibration/goals/recent-attack-defense/protocol";
export { runGoalsRecentAttackDefenseAudit } from "@/lib/debug/calibration/goals/recent-attack-defense/evaluate";
export {
  digestGoalsRestProtocol,
  goalsRestProtocol,
  GOALS_REST_PROTOCOL_VERSION,
  GOALS_REST_PARENT_G1_K,
} from "@/lib/debug/calibration/goals/rest-schedule/protocol";
export { runGoalsRestScheduleAudit } from "@/lib/debug/calibration/goals/rest-schedule/evaluate";

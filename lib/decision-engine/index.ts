export type {
  ApexConfidenceBand,
  ApexConfidenceBlock,
  ApexDecision,
  ApexDecisionInput,
  ApexDecisionReason,
  ApexDecisionSide,
  ApexDecisionVerdictKind,
  ApexRiskBand,
  ApexRiskBlock,
  ApexScoreComponent,
  ApexScoreComponentKey,
  ApexSizingBlock,
  ApexValueBlock,
  DecisionEnginePort,
} from "@/lib/decision-engine/types";

export {
  DECISION_COMPONENT_LABELS,
  DECISION_POSITIVE_WEIGHTS,
  MAX_STAKE_PCT,
  STAKE_STEPS,
} from "@/lib/decision-engine/weights";

export { evaluateDecision, createDeterministicDecisionEngine } from "@/lib/decision-engine/evaluate";
export { evaluateValue } from "@/lib/decision-engine/value";
export { evaluateRisk } from "@/lib/decision-engine/risk";
export { evaluateConfidence } from "@/lib/decision-engine/confidence";
export { evaluateSizing, snapStake } from "@/lib/decision-engine/sizing";
export { decideVerdict, VERDICT_META } from "@/lib/decision-engine/verdict";
export {
  decisionInputFromMatch,
  evaluateMatchDecision,
  type DecisionMatchExtras,
  type MatchAnalysisCore,
} from "@/lib/decision-engine/from-match";

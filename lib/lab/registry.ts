/**
 * Published research catalogue — engines that already exist in APEX.
 * Status "stub" means the contract is in-repo but the implementation throws.
 */

import { DEFAULT_HYBRID_CONFIG } from "@/lib/intelligence/modules/probability/hybrid/config";
import type { LabModelRecord } from "@/lib/lab/types";

export const LAB_SECTIONS = [
  { id: "library", label: "Model Library" },
  { id: "backtest", label: "Backtesting Engine" },
  { id: "strategy", label: "Strategy Builder" },
  { id: "compare", label: "Model Comparison" },
  { id: "simulate", label: "Historical Simulation" },
  { id: "reports", label: "Performance Reports" },
  { id: "explain", label: "Explainability Viewer" },
  { id: "features", label: "Feature Importance" },
  { id: "decision", label: "Decision Breakdown" },
  { id: "versions", label: "Model Versions" },
] as const;

export type LabSectionId = (typeof LAB_SECTIONS)[number]["id"];

export const LAB_MODELS: LabModelRecord[] = [
  {
    id: "decision-engine",
    name: "APEX Decision Engine",
    version: "deterministic-v1",
    role: "Recommendation",
    method: "Weighted pillars · ¼ Kelly · 5-tier verdict",
    status: "production",
    sample: "Today's Opportunities scan",
    surfaces: ["Opportunities", "Match Analysis", "Feed"],
    href: "/opportunities",
    notes:
      "Deterministic. No LLM. Missing catalogue signals stay n/d and are dropped from the score.",
  },
  {
    id: "probability-engine",
    name: "Probability Engine",
    version: DEFAULT_HYBRID_CONFIG.modelVersion,
    role: "1X2 · O/U 2.5",
    method: `Elo × Poisson blend w=${DEFAULT_HYBRID_CONFIG.poissonBlendWeight}`,
    status: "production",
    sample: "Learning Engine closed book",
    surfaces: ["Match Analysis", "Match Center", "Copilot"],
    href: "/match-analysis",
    notes:
      "Hybrid Elo–Poisson. Closed-book accuracy comes from Learning Engine fixtures, not a new tape.",
  },
  {
    id: "match-rating",
    name: "APEX Match Rating",
    version: "rating-v1",
    role: "0–100 fixture score",
    method: "10 published metrics, coverage-weighted",
    status: "production",
    sample: "Featured Match Analysis",
    surfaces: ["Match Analysis"],
    href: "/match-analysis",
    notes:
      "Legacy 10-metric board. Decision Engine is the source of truth for stake and verdict.",
  },
  {
    id: "explainable-ai",
    name: "Explainable AI",
    version: "rules-v1",
    role: "Why this pick",
    method: "Rule factors from Probability Engine + form",
    status: "production",
    sample: "Featured Match Analysis",
    surfaces: ["Match Analysis", "Match Center", "Copilot"],
    href: "/match-analysis",
    notes: "Structured explanation. method is always rules. No OpenAI.",
  },
  {
    id: "learning-engine",
    name: "Learning Engine",
    version: "evaluator-v1",
    role: "Post-match evaluation",
    method: "Accuracy · ECE · Brier · biases · knowledge",
    status: "research",
    sample: "4 closed-book mock fixtures",
    surfaces: ["APEX Lab"],
    href: "/lab#reports",
    notes:
      "Mock-first closed loop. Does not modify the Probability Engine or Decision Engine.",
  },
  {
    id: "match-analysis-rules",
    name: "Match Analysis rules",
    version: "sprint-8",
    role: "Analyst briefing",
    method: "Deterministic rules over PE + Data Platform",
    status: "production",
    sample: "Featured Match Analysis",
    surfaces: ["Match Center", "Match Analysis"],
    href: "/match-center",
    notes: "No LLM. Intelligence Report and risks are published from the same bundle.",
  },
];

export function modelById(id: LabModelRecord["id"]): LabModelRecord {
  const row = LAB_MODELS.find((model) => model.id === id);
  if (!row) throw new Error(`Unknown lab model: ${id}`);
  return row;
}

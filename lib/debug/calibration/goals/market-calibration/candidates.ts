/**
 * GOALS-1G.1 — Calibrator candidates and cross-market coherence requirements.
 * Documentation only — nothing is fitted.
 */

export const GOALS_MCAL_CALIBRATOR_CANDIDATES = {
  CAL_0: {
    name: "identity",
    description: "No calibration; emit raw G1 probabilities.",
    dataRequirements: "none",
    overfittingRisk: "none",
    coherence: "preserves all G1 monotonicity and complements",
    caveats: "Leaves residual CITL / bin gaps uncorrected.",
  },
  CAL_1: {
    name: "logistic_recalibration",
    description: "logit(p_cal) = a + b * logit(p_raw) fitted per market or shared family.",
    dataRequirements: "moderate N; unstable if rare class (e.g. U0.5 / 0-0)",
    overfittingRisk: "low if 2 params and development-only fit",
    coherence:
      "Independent per-threshold fits can break match-total / team-total monotonicity — must enforce post-hoc or fit jointly",
    caveats: "Extrapolation outside training probability range; sparse negatives for O0.5.",
  },
  CAL_2: {
    name: "isotonic_calibration",
    description: "Nonparametric monotone mapping raw→calibrated within [0,1].",
    dataRequirements: "higher N; poor on sparse bins",
    overfittingRisk: "medium–high without strong regularization / CV",
    coherence:
      "Per-threshold isotonic almost certainly breaks cross-threshold monotonicity if applied independently",
    caveats: "Step-function artifacts; weak on O/U0.5 rare class.",
  },
  CAL_3: {
    name: "monotone_shared_threshold_calibration",
    description:
      "Shared structure across match-total thresholds preserving P(O0.5)>=…>=P(O4.5).",
    dataRequirements: "requires evidence that thresholds share bias pattern",
    overfittingRisk: "lower parameter count if shared; higher if over-parameterized",
    coherence: "designed to preserve monotonicity and complements by construction",
    caveats: "Only justified if Task 9 finds shared bias; do not invent without evidence.",
  },
} as const;

export const GOALS_MCAL_CROSS_MARKET_COHERENCE_REQUIREMENTS = {
  matchTotalMonotonicity:
    "P(O0.5) >= P(O1.5) >= P(O2.5) >= P(O3.5) >= P(O4.5)",
  homeTeamTotalMonotonicity: "P(O0.5) >= P(O1.5) >= P(O2.5)",
  awayTeamTotalMonotonicity: "P(O0.5) >= P(O1.5) >= P(O2.5)",
  complements: "P(Over x.5) + P(Under x.5) = 1; BTTS YES + NO = 1",
  failClosed:
    "If a candidate calibrator violates any invariant, reject the calibrated bundle and fall back to raw G1 (CAL_0).",
  independentThresholdBan:
    "Independent high-capacity calibrators per threshold are NOT acceptable if they break monotonicity.",
  sparseOu05:
    "O/U 0.5 negative class (0-0) is rare — high-capacity calibrators are especially discouraged.",
} as const;

export type SharedVsSpecificRecommendation =
  | "SHARED_MATCH_TOTAL_CANDIDATE"
  | "SEPARATE_PER_THRESHOLD"
  | "GROUPED_THRESHOLDS"
  | "INSUFFICIENT_EVIDENCE"
  | "RAW_ADEQUATE";

export function recommendSharedVsSpecific(input: {
  matchTotalCitls: { market: string; citl23: number; citl24: number }[];
  homeAwayCitls: { market: string; citl23: number; citl24: number }[];
  temporalClasses: Record<string, string>;
}): {
  recommendation: SharedVsSpecificRecommendation;
  rationale: string;
} {
  const mt = input.matchTotalCitls;
  const signs24 = mt.map((m) => Math.sign(m.citl24) || 0);
  const allSameSign24 =
    signs24.every((s) => s === signs24[0]) && signs24[0] !== 0;
  const mags = mt.map((m) => Math.abs(m.citl24));
  const maxMag = Math.max(...mags);
  const minMag = Math.min(...mags);
  const similarMag = maxMag > 0 && minMag / maxMag > 0.5;

  const lowSupportCount = Object.values(input.temporalClasses).filter(
    (c) => c === "LOW_SUPPORT",
  ).length;
  const goodCount = Object.values(input.temporalClasses).filter(
    (c) => c === "STABLE_GOOD",
  ).length;
  const biasedCount = Object.values(input.temporalClasses).filter(
    (c) => c === "STABLE_BIASED",
  ).length;

  if (goodCount >= 8 && biasedCount === 0) {
    return {
      recommendation: "RAW_ADEQUATE",
      rationale:
        "Most markets STABLE_GOOD; raw G1 calibration adequate without fitting.",
    };
  }
  if (lowSupportCount >= 4) {
    return {
      recommendation: "INSUFFICIENT_EVIDENCE",
      rationale: "Too many LOW_SUPPORT markets for high-capacity calibration.",
    };
  }
  if (allSameSign24 && similarMag && biasedCount >= 2) {
    return {
      recommendation: "SHARED_MATCH_TOTAL_CANDIDATE",
      rationale:
        "Match-total CITL shares sign and similar magnitude — shared/grouped CAL_1 or CAL_3 may be justified in 1G.2.",
    };
  }
  if (biasedCount >= 2 && !similarMag) {
    return {
      recommendation: "SEPARATE_PER_THRESHOLD",
      rationale:
        "Material bias differs by threshold; any POC must still enforce cross-threshold monotonicity.",
    };
  }
  if (biasedCount >= 1 || goodCount < Object.keys(input.temporalClasses).length) {
    return {
      recommendation: "GROUPED_THRESHOLDS",
      rationale:
        "Mixed pattern — consider grouped match-total vs team-total families rather than 12 independent fits.",
    };
  }
  return {
    recommendation: "INSUFFICIENT_EVIDENCE",
    rationale: "No clear shared or separate calibration pattern.",
  };
}

/**
 * GOALS-1F.1 — Evidence classifications (descriptive only).
 */

import type { BootstrapInterval } from "@/lib/debug/calibration/goals/distributional-audit/bootstrap";
import type {
  DispersionReport,
  LowScoreCellReport,
} from "@/lib/debug/calibration/goals/distributional-audit/diagnostics";

export type SeasonLowScore = {
  zeroZero: LowScoreCellReport;
  lowScore2x2: {
    observedMass: number;
    expectedMass: number;
    oeRatio: number | null;
  };
  residualCorr: number | null;
};

export function classifyDixonColes(
  s2023: SeasonLowScore,
  s2024: SeasonLowScore,
  bootstrap2024: { zeroZeroRateDiff: BootstrapInterval; residualHomeAwayCorr: BootstrapInterval },
): { classification: string; rationale: string } {
  const zz23 = s2023.zeroZero.observedFrequency - s2023.zeroZero.meanPredictedProbability;
  const zz24 = s2024.zeroZero.observedFrequency - s2024.zeroZero.meanPredictedProbability;
  // Overprediction of 0-0 => negative (obs - pred)
  const bothOverpred00 = zz23 < -0.005 && zz24 < -0.005;
  const bothUnderpred00 = zz23 > 0.005 && zz24 > 0.005;
  const ls23 =
    s2023.lowScore2x2.observedMass - s2023.lowScore2x2.expectedMass;
  const ls24 =
    s2024.lowScore2x2.observedMass - s2024.lowScore2x2.expectedMass;
  const bothLowScoreSameSign =
    (ls23 > 0.01 && ls24 > 0.01) || (ls23 < -0.01 && ls24 < -0.01);
  const corrNegBoth =
    (s2023.residualCorr ?? 0) < -0.05 && (s2024.residualCorr ?? 0) < -0.05;
  const boot00CoversZero =
    bootstrap2024.zeroZeroRateDiff.p2_5 <= 0 &&
    bootstrap2024.zeroZeroRateDiff.p97_5 >= 0;

  if (
    (bothOverpred00 || bothUnderpred00) &&
    bothLowScoreSameSign &&
    corrNegBoth &&
    !boot00CoversZero
  ) {
    return {
      classification: "CONSISTENT_DC_EVIDENCE",
      rationale:
        "0-0 and low-score 2x2 miscalibration replicate across seasons with residual negative dependence and bootstrap interval excluding zero for 0-0 rate diff.",
    };
  }
  if (
    (bothOverpred00 || bothUnderpred00 || bothLowScoreSameSign) &&
    (Math.abs(zz23) > 0.005 || Math.abs(zz24) > 0.005)
  ) {
    return {
      classification: "WEAK_DC_EVIDENCE",
      rationale:
        "Some low-score / 0-0 pattern appears but does not meet consistent multi-signal replication with residual dependence and bootstrap exclusion of zero.",
    };
  }
  if (boot00CoversZero && Math.abs(zz24) < 0.02 && Math.abs(zz23) < 0.02) {
    return {
      classification: "NO_DC_EVIDENCE",
      rationale:
        "0-0 rate differences are small and bootstrap uncertainty for 2024 covers zero; residual dependence is not a consistent DC signature across seasons.",
    };
  }
  return {
    classification: "INCONCLUSIVE",
    rationale:
      "Signals conflict across seasons or are too small relative to bootstrap uncertainty to support a Dixon-Coles extension.",
  };
}

export function classifyNegativeBinomial(
  d2023: DispersionReport,
  d2024: DispersionReport,
  bootstrap2024: { pearsonTotalDispersion: BootstrapInterval },
): { classification: string; rationale: string } {
  const overBoth =
    d2023.classification === "POSSIBLE_OVERDISPERSION" &&
    d2024.classification === "POSSIBLE_OVERDISPERSION";
  const underBoth =
    d2023.classification === "POSSIBLE_UNDERDISPERSION" &&
    d2024.classification === "POSSIBLE_UNDERDISPERSION";
  const boot = bootstrap2024.pearsonTotalDispersion;
  const bootOver = boot.p2_5 > 1.05;
  const bootUnder = boot.p97_5 < 0.95;

  if (overBoth && bootOver) {
    return {
      classification: "CONSISTENT_OVERDISPERSION_EVIDENCE",
      rationale:
        "Pearson dispersion >1 replicates across seasons and 2024 bootstrap interval lies above 1.05.",
    };
  }
  if (underBoth && bootUnder) {
    return {
      classification: "POSSIBLE_UNDERDISPERSION",
      rationale:
        "Pearson dispersion <1 replicates across seasons and 2024 bootstrap interval lies below 0.95.",
    };
  }
  if (
    d2023.classification === "NO_OBVIOUS_DISPERSION_PROBLEM" &&
    d2024.classification === "NO_OBVIOUS_DISPERSION_PROBLEM" &&
    boot.p2_5 <= 1 &&
    boot.p97_5 >= 1
  ) {
    return {
      classification: "NO_NB_EVIDENCE",
      rationale:
        "Neither season shows an obvious dispersion problem; bootstrap Pearson total dispersion interval covers 1.",
    };
  }
  if (
    d2023.classification !== d2024.classification ||
    d2023.classification === "INCONCLUSIVE" ||
    d2024.classification === "INCONCLUSIVE"
  ) {
    return {
      classification: "INCONCLUSIVE",
      rationale: "Dispersion classifications conflict across seasons or are mixed.",
    };
  }
  return {
    classification: "WEAK_NB_EVIDENCE",
    rationale:
      "Mild dispersion signal without consistent multi-season bootstrap confirmation.",
  };
}

export function classifyOu05(
  s2023: { zeroZero: LowScoreCellReport; u05Diff: number; ll: number },
  s2024: { zeroZero: LowScoreCellReport; u05Diff: number; ll: number },
  bootstrap2024: { zeroZeroRateDiff: BootstrapInterval },
): { classification: string; rationale: string } {
  const d23 =
    s2023.zeroZero.observedFrequency - s2023.zeroZero.meanPredictedProbability;
  const d24 =
    s2024.zeroZero.observedFrequency - s2024.zeroZero.meanPredictedProbability;
  const abs23 = Math.abs(d23);
  const abs24 = Math.abs(d24);
  const sameSign = d23 * d24 > 0;
  const bootCoversZero =
    bootstrap2024.zeroZeroRateDiff.p2_5 <= 0 &&
    bootstrap2024.zeroZeroRateDiff.p97_5 >= 0;

  if (abs23 < 0.01 && abs24 < 0.01 && bootCoversZero) {
    return {
      classification: "OU05_WELL_REPRESENTED",
      rationale:
        "0-0 / U0.5 calibration differences are small in both seasons and bootstrap covers zero.",
    };
  }
  if (sameSign && abs23 < 0.025 && abs24 < 0.025) {
    return {
      classification: "OU05_MINOR_MIScalibration",
      rationale:
        "Small same-sign 0-0 miscalibration replicates across seasons but magnitude remains modest.",
    };
  }
  if (sameSign && abs23 >= 0.025 && abs24 >= 0.025 && !bootCoversZero) {
    return {
      classification: "OU05_SYSTEMATIC_MIScalibration",
      rationale:
        "Replicating same-sign 0-0 miscalibration of material size with bootstrap excluding zero.",
    };
  }
  return {
    classification: "OU05_INCONCLUSIVE",
    rationale:
      "O/U 0.5 / 0-0 error pattern does not clearly replicate with material magnitude.",
  };
}

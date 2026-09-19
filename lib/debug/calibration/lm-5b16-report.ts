/**
 * 5B.16 forensic classifications. No ranking. No production arm.
 */

import type { ArmMetrics, SeasonLocalReport } from "@/lib/debug/calibration/lm-5b16-evaluate";
import {
  DRAW_FORENSICS_DEVELOPMENT_SEASON,
  DRAW_FORENSICS_HOLDOUT_SEASONS,
} from "@/lib/debug/calibration/draw-5b7-shape";

export type ForensicAnswer = "YES" | "NO" | "MIXED";

export type LocalMassAttribution = {
  localTargetability: ForensicAnswer;
  twoTwoSpecificity: ForensicAnswer;
  highEqualRecovery: ForensicAnswer;
  lowEqualPreservation: ForensicAnswer;
  classCalibrationDamage: ForensicAnswer;
  temporalConsistency: ForensicAnswer;
  transferVsRenormalization: ForensicAnswer;
  d0Pathology: ForensicAnswer;
  productionCorrectionReady: ForensicAnswer;
};

function oeOf(arm: ArmMetrics, key: string): number | null {
  return arm.scorelines.find((row) => row.key === key)?.oeRatio ?? null;
}

function towardOne(before: number | null, after: number | null): boolean {
  if (before == null || after == null) return false;
  return Math.abs(after - 1) + 0.05 <= Math.abs(before - 1);
}

export function classifyLocalMass(input: {
  reports: readonly SeasonLocalReport[];
  holdoutD1: readonly ArmMetrics[];
  holdoutD0: readonly ArmMetrics[];
}): LocalMassAttribution {
  for (const report of input.reports) {
    if (
      (DRAW_FORENSICS_HOLDOUT_SEASONS as readonly string[]).includes(report.season) &&
      report.role !== "HOLDOUT"
    ) {
      throw new Error(`${report.season} must remain HOLDOUT`);
    }
    if (report.season === DRAW_FORENSICS_DEVELOPMENT_SEASON && report.role !== "DEVELOPMENT") {
      throw new Error("PL 2024 must remain DEVELOPMENT");
    }
  }

  const d1Hold = input.holdoutD1;
  const m0 = d1Hold.find((row) => row.arm === "M0");
  const t1 = d1Hold.find((row) => row.arm === "T1");
  const m1 = d1Hold.find((row) => row.arm === "M1");
  const probes = d1Hold.filter((row) => row.arm !== "M0");

  const localTargetability =
    t1 != null && Math.abs(t1.meanChange.p00) < 1e-6 && Math.abs(t1.meanChange.p11) < 1e-6
      ? "YES"
      : t1 != null && Math.abs(t1.meanChange.p00) < 1e-4 && Math.abs(t1.meanChange.p11) < 1e-4
        ? "YES"
        : "NO";

  const twoTwoSpecificity = probes.every((row) => row.addedShare.twoTwo > 0.5) ? "YES" : "NO";

  const highBefore = m0 ? oeOf(m0, "HIGH_EQUAL") : null;
  const recoveryFlags = probes.map((row) => towardOne(highBefore, oeOf(row, "HIGH_EQUAL")));
  const highEqualRecovery = recoveryFlags.every(Boolean)
    ? "YES"
    : recoveryFlags.some(Boolean)
      ? "MIXED"
      : "NO";

  const lowEqualPreservation =
    t1 != null && !t1.lowEqualFlag && Math.abs(t1.lowEqualRateChange) < 0.005 ? "YES" : "MIXED";

  const classCalibrationDamage = probes.some(
    (row) =>
      m0 != null &&
      (Math.abs(row.logLoss - m0.logLoss) > 0.01 ||
        Math.abs(row.drawBias - m0.drawBias) > 0.02 ||
        Math.abs(row.ece - m0.ece) > 0.02),
  )
    ? "YES"
    : "NO";

  const d1Reports = input.reports.filter((report) => report.panel === "D1");
  const temporalFlags = d1Reports.flatMap((report) =>
    (["H1", "H2"] as const).map((window) => {
      const control = report.halves[window].byArm.M0?.oeRatio;
      const moved = (["M1", "M2", "M3", "T1"] as const).map((arm) => {
        const after = report.halves[window].byArm[arm]?.oeRatio;
        return towardOne(control ?? null, after ?? null) || (control != null && after != null && after < control);
      });
      return moved.every(Boolean);
    }),
  );
  const temporalConsistency = temporalFlags.every(Boolean)
    ? "YES"
    : temporalFlags.some(Boolean)
      ? "MIXED"
      : "NO";

  const transferVsRenormalization =
    t1 != null &&
    m1 != null &&
    Math.abs(t1.meanChange.p00) + 0.0005 < Math.abs(m1.meanChange.p00)
      ? "YES"
      : "NO";

  const d0m0 = input.holdoutD0.find((row) => row.arm === "M0");
  const d0m3 = input.holdoutD0.find((row) => row.arm === "M3");
  const d1m3 = d1Hold.find((row) => row.arm === "M3");
  const d0Pathology =
    d0m0 != null &&
    d0m3 != null &&
    d1m3 != null &&
    (oeOf(d0m3, "HIGH_EQUAL") ?? 0) > (oeOf(d1m3, "HIGH_EQUAL") ?? 0) + 0.15
      ? "YES"
      : "MIXED";

  return {
    localTargetability,
    twoTwoSpecificity,
    highEqualRecovery,
    lowEqualPreservation,
    classCalibrationDamage,
    temporalConsistency,
    transferVsRenormalization,
    d0Pathology,
    productionCorrectionReady: "NO",
  };
}

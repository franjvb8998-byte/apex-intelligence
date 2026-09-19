/**
 * 5B.7 forensic reporter. Classification only. No ranking. No production choice.
 */

import type {
  DrawMassDecomposition,
  DrawCurveRow,
  SeasonDrawForensics,
} from "@/lib/debug/calibration/draw-5b7-evaluate";
import { decomposeDrawMass } from "@/lib/debug/calibration/draw-5b7-evaluate";
import type { DrawBaseSensitivityCell } from "@/lib/debug/calibration/draw-5b7-sensitivity";
import type { DrawTrace } from "@/lib/debug/calibration/draw-5b7-trace";
import {
  DRAW_FORENSICS_DEVELOPMENT_SEASON,
  DRAW_FORENSICS_HOLDOUT_SEASONS,
} from "@/lib/debug/calibration/draw-5b7-shape";

export type ForensicAnswer = "YES" | "NO" | "MIXED";

export type ComponentAttribution = {
  eloDrawComponent: ForensicAnswer;
  poissonDrawComponent: ForensicAnswer;
  blendLowersRelativeToBothInputs: "YES" | "NO";
  homeAdvantageStack: ForensicAnswer;
  eloGap: ForensicAnswer;
  xgImbalance: ForensicAnswer;
  totalXg: ForensicAnswer;
  confidence: ForensicAnswer;
};

function yesNoMixed(flags: readonly boolean[]): ForensicAnswer {
  if (flags.length === 0) return "MIXED";
  if (flags.every(Boolean)) return "YES";
  if (flags.every((flag) => !flag)) return "NO";
  return "MIXED";
}

function underAllocates(decomposition: DrawMassDecomposition): boolean {
  return decomposition.meanEloDraw < decomposition.observedDraw;
}

function poissonUnderAllocates(decomposition: DrawMassDecomposition): boolean {
  return decomposition.meanPoissonDraw < decomposition.observedDraw;
}

function blendLowersVsBoth(decomposition: DrawMassDecomposition): boolean {
  return (
    decomposition.meanHybridDraw < decomposition.meanEloDraw &&
    decomposition.meanHybridDraw < decomposition.meanPoissonDraw
  );
}

function biasAt(
  curve: readonly DrawCurveRow[],
  bucket: string,
): number | null {
  const row = curve.find((item) => item.bucket === bucket);
  if (!row || row.n === 0) return null;
  return row.hybridDrawBias;
}

function growsWithBucket(
  curve: readonly DrawCurveRow[],
  low: string,
  high: string,
  minDelta = 0.02,
): boolean | null {
  const lowBias = biasAt(curve, low);
  const highBias = biasAt(curve, high);
  if (lowBias == null || highBias == null) return null;
  return highBias < lowBias - minDelta;
}

export function classifyComponentAttribution(input: {
  v0: readonly SeasonDrawForensics[];
  v5: readonly SeasonDrawForensics[];
}): ComponentAttribution {
  const v0BySeason = new Map(input.v0.map((item) => [item.season, item]));
  const paired = input.v5.map((v5) => {
    const v0 = v0BySeason.get(v5.season);
    if (!v0) throw new Error(`Missing V0 for season ${v5.season}`);
    return { v0, v5 };
  });
  const blendFlags = paired.map(({ v0 }) => blendLowersVsBoth(v0.decomposition));
  const haFlags = paired.map(({ v0, v5 }) => v0.decomposition.observedMinusHybrid > v5.decomposition.observedMinusHybrid + 0.01);
  const eloGapFlags = paired
    .map(({ v0 }) => growsWithBucket(v0.eloGapCurve, "0-49", "250+", 0.02))
    .filter((flag): flag is boolean => flag != null);
  const xgFlags = paired
    .map(({ v0 }) => growsWithBucket(v0.xgDiffCurve, "<0.25", "1.50+", 0.02))
    .filter((flag): flag is boolean => flag != null);
  const totalFlags = paired
    .map(({ v0 }) => growsWithBucket(v0.totalXgCurve, "<2.0", "3.5+", 0.02))
    .filter((flag): flag is boolean => flag != null);
  const confidenceFlags = paired.map(({ v0 }) => {
    const high = v0.confidence.find((row) => row.band === "high");
    if (!high || high.n === 0) return false;
    return high.drawBias < -0.05 && high.observedDraw > 0;
  });
  return {
    eloDrawComponent: yesNoMixed(paired.map(({ v0 }) => underAllocates(v0.decomposition))),
    poissonDrawComponent: yesNoMixed(
      paired.map(({ v0 }) => poissonUnderAllocates(v0.decomposition)),
    ),
    blendLowersRelativeToBothInputs: blendFlags.every(Boolean) ? "YES" : "NO",
    homeAdvantageStack: yesNoMixed(haFlags),
    eloGap: yesNoMixed(eloGapFlags),
    xgImbalance: yesNoMixed(xgFlags),
    totalXg: yesNoMixed(totalFlags),
    confidence: yesNoMixed(confidenceFlags),
  };
}

export function poolTraces(seasons: readonly SeasonDrawForensics[]): DrawTrace[] {
  return seasons.flatMap((season) => season.traces);
}

export function descriptivePoolDecomposition(
  seasons: readonly SeasonDrawForensics[],
): DrawMassDecomposition & { seasons: string[]; roles: string[] } {
  return {
    ...decomposeDrawMass(poolTraces(seasons)),
    seasons: seasons.map((season) => season.season),
    roles: seasons.map((season) => season.role),
  };
}

export function assertHoldoutsUntuned(input: {
  seasons: ReadonlyArray<{ season: string; role: string }>;
}): void {
  for (const season of input.seasons) {
    if (
      (DRAW_FORENSICS_HOLDOUT_SEASONS as readonly string[]).includes(season.season) &&
      season.role !== "HOLDOUT"
    ) {
      throw new Error(`${season.season} must remain HOLDOUT`);
    }
    if (season.season === DRAW_FORENSICS_DEVELOPMENT_SEASON && season.role !== "DEVELOPMENT") {
      throw new Error("PL 2024 must remain DEVELOPMENT");
    }
  }
}

export type DrawForensicsReport = {
  seasons: Record<string, { role: "HOLDOUT" | "DEVELOPMENT"; V0: SeasonDrawForensics; V5: SeasonDrawForensics }>;
  descriptivePool: {
    V0: ReturnType<typeof descriptivePoolDecomposition>;
    V5: ReturnType<typeof descriptivePoolDecomposition>;
  };
  attribution: ComponentAttribution;
  sensitivity: Record<string, { V0: DrawBaseSensitivityCell[]; V5: DrawBaseSensitivityCell[] }>;
};

type SeasonReportInput = {
  season: string;
  role: "HOLDOUT" | "DEVELOPMENT";
  V0: SeasonDrawForensics;
  V5: SeasonDrawForensics;
  sensitivityV0: DrawBaseSensitivityCell[];
  sensitivityV5: DrawBaseSensitivityCell[];
};

export function buildDrawForensicsReport(input: {
  seasons: readonly SeasonReportInput[];
}): DrawForensicsReport {
  assertHoldoutsUntuned({ seasons: input.seasons });
  const v0 = input.seasons.map((item) => item.V0);
  const v5 = input.seasons.map((item) => item.V5);
  return {
    seasons: Object.fromEntries(
      input.seasons.map((item) => [
        item.season,
        { role: item.role, V0: item.V0, V5: item.V5 },
      ]),
    ),
    descriptivePool: {
      V0: descriptivePoolDecomposition(v0),
      V5: descriptivePoolDecomposition(v5),
    },
    attribution: classifyComponentAttribution({ v0, v5 }),
    sensitivity: Object.fromEntries(
      input.seasons.map((item) => [
        item.season,
        { V0: item.sensitivityV0, V5: item.sensitivityV5 },
      ]),
    ),
  };
}

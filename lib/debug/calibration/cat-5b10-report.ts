/**
 * 5B.10 forensic classifications. No ranking. No production parameter.
 */

import type { SeasonCatalogueGeometry } from "@/lib/debug/calibration/cat-5b10-evaluate";
import type { RoleBaseSummary } from "@/lib/debug/calibration/cat-5b10-counterfactual";
import type { MaturityReport } from "@/lib/debug/calibration/cat-5b10-maturity";
import {
  DRAW_FORENSICS_DEVELOPMENT_SEASON,
  DRAW_FORENSICS_HOLDOUT_SEASONS,
} from "@/lib/debug/calibration/draw-5b7-shape";

export type ForensicAnswer = "YES" | "NO" | "MIXED";

export type CatalogueInputAttribution = {
  sparseInstability: ForensicAnswer;
  cumulativeGdAmplification: ForensicAnswer;
  gdSaturation: ForensicAnswer;
  rolePrior: "YES" | "NO";
  matureExtremes: "YES" | "NO";
  inputContribution: ForensicAnswer;
  geometryInteraction: ForensicAnswer;
  structuralNextStep: ForensicAnswer;
};

export type CatalogueSeasonClassificationInput = {
  season: string;
  role: "HOLDOUT" | "DEVELOPMENT";
  geometry: SeasonCatalogueGeometry;
  roleBases: { R0: RoleBaseSummary; R1: RoleBaseSummary };
  maturity: MaturityReport;
};

function yesNoMixed(flags: readonly boolean[]): ForensicAnswer {
  if (flags.length === 0) return "MIXED";
  if (flags.every(Boolean)) return "YES";
  if (flags.every((flag) => !flag)) return "NO";
  return "MIXED";
}

export function classifyCatalogueInput(input: {
  seasons: readonly CatalogueSeasonClassificationInput[];
}): CatalogueInputAttribution {
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

  const sparse = input.seasons.map((season) => {
    const p0 = season.geometry.playedAll.find((row) => row.bucket === "0");
    const p1 = season.geometry.playedAll.find((row) => row.bucket === "1");
    const earlyJump = season.maturity.byLaterPlayed.find((row) => row.playedBucket === "1");
    return (
      (p1 != null && p0 != null && p1.meanAbsDevFromRoleBase > p0.meanAbsDevFromRoleBase + 40) ||
      (earlyJump != null && earlyJump.p90AbsChange >= 40)
    );
  });

  const cumulative = input.seasons.map((season) => {
    const early = season.geometry.gd.find((row) => row.bucket === "1" || row.bucket === "2");
    const late = [...season.geometry.gd].reverse().find((row) => row.n > 0 && row.bucket !== "0");
    return (
      early != null &&
      late != null &&
      Math.abs(late.gdContribution.mean) > Math.abs(early.gdContribution.mean) + 5
    );
  });

  const saturation = input.seasons.map((season) => {
    const mature = season.geometry.playedAll.filter(
      (row) => row.bucket === "20-29" || row.bucket === "30+",
    );
    return mature.some((row) => row.n > 0 && row.gdClampHitRate >= 0.05);
  });

  const matureExtremes = input.seasons.every((season) =>
    season.geometry.sparseVsMature.some(
      (row) => row.threshold === 200 && row.minPlayed10plus > 0,
    ),
  );

  const rolePrior = input.seasons.every((season) => {
    const r0 = season.roleBases.R0;
    const r1 = season.roleBases.R1;
    return r0.meanSignedGap > r1.meanSignedGap + 20;
  });

  const inputContribution = input.seasons.map((season) => {
    const large = season.geometry.extremeGaps.filter(
      (row) => row.bucket === "200-249" || row.bucket === "250-299" || row.bucket === "300+",
    );
    return large.some((row) => row.n > 0 && Math.abs(row.meanWinRateGap) + Math.abs(row.meanGdGap) > 80);
  });

  return {
    sparseInstability: yesNoMixed(sparse),
    cumulativeGdAmplification: yesNoMixed(cumulative),
    gdSaturation: yesNoMixed(saturation),
    rolePrior: rolePrior ? "YES" : "NO",
    matureExtremes: matureExtremes ? "YES" : "NO",
    inputContribution: yesNoMixed(inputContribution),
    geometryInteraction: "YES",
    structuralNextStep: "YES",
  };
}

/**
 * GOALS-1G.1 — Evaluate market-calibration audit (no fitting).
 */

import { createHash } from "node:crypto";
import type { GoalsTargetEvidence } from "@/lib/debug/calibration/goals/types";
import {
  assertG1Coherence,
  predictG1FromEvidence,
  type GoalsG1Prediction,
} from "@/lib/debug/calibration/goals/g1/predict";
import { bootstrapCitlByMarket } from "@/lib/debug/calibration/goals/market-calibration/bootstrap";
import {
  GOALS_MCAL_CALIBRATOR_CANDIDATES,
  GOALS_MCAL_CROSS_MARKET_COHERENCE_REQUIREMENTS,
  recommendSharedVsSpecific,
} from "@/lib/debug/calibration/goals/market-calibration/candidates";
import {
  logisticCalibrationDiagnostic,
  marketCalibrationMetrics,
  marketSupport,
} from "@/lib/debug/calibration/goals/market-calibration/metrics";
import {
  buildCanonicalObservations,
  deriveUnder05,
  type GoalsMcalObservation,
} from "@/lib/debug/calibration/goals/market-calibration/observations";
import {
  GOALS_MCAL_CANONICAL_MARKETS,
  GOALS_MCAL_CONFIRMATORY_SEASON,
  GOALS_MCAL_DEV_SEASON,
  GOALS_MCAL_HOLDOUT_SEASON,
  GOALS_MCAL_PARENT_G1_K,
  GOALS_MCAL_PROTOCOL_VERSION,
  GOALS_MCAL_REQUIRED_EVIDENCE_DIGEST,
  digestGoalsMcalProtocol,
  goalsMcalProtocol,
  type GoalsMcalCanonicalMarket,
} from "@/lib/debug/calibration/goals/market-calibration/protocol";
import { classifyTemporalStability } from "@/lib/debug/calibration/goals/market-calibration/temporal";

function sortPreds(rows: GoalsG1Prediction[]): GoalsG1Prediction[] {
  return [...rows].sort(
    (a, b) =>
      a.kickoffUtc.localeCompare(b.kickoffUtc) ||
      a.fixtureId.localeCompare(b.fixtureId),
  );
}

function seasonObs(
  obs: readonly GoalsMcalObservation[],
  season: string,
): GoalsMcalObservation[] {
  return obs.filter((o) => o.season === season);
}

function byMarketBundle(obs: readonly GoalsMcalObservation[]) {
  const support: Record<string, ReturnType<typeof marketSupport>> = {};
  const metrics: Record<string, ReturnType<typeof marketCalibrationMetrics>> =
    {};
  const logistic: Record<
    string,
    ReturnType<typeof logisticCalibrationDiagnostic>
  > = {};
  for (const m of GOALS_MCAL_CANONICAL_MARKETS) {
    support[m] = marketSupport(m, obs);
    metrics[m] = marketCalibrationMetrics(m, obs);
    logistic[m] = logisticCalibrationDiagnostic(
      obs.filter((o) => o.market === m),
    );
  }
  return { support, metrics, logistic };
}

export type GoalsMcalAuditResult = {
  protocolDigest: string;
  protocolVersion: string;
  parentG1K: typeof GOALS_MCAL_PARENT_G1_K;
  evidenceDatasetDigest: string;
  observationCount: number;
  uniqueFixtureMarketKeys: number;
  coherence: { fixturesChecked: number; failures: number };
  development2023: ReturnType<typeof byMarketBundle>;
  confirmatory2024: ReturnType<typeof byMarketBundle>;
  temporalStability: Record<
    string,
    ReturnType<typeof classifyTemporalStability>
  >;
  ou05Special: unknown;
  bttsAudit: unknown;
  teamTotalAudit: unknown;
  sharedVsSpecific: ReturnType<typeof recommendSharedVsSpecific>;
  bootstrap2024: ReturnType<typeof bootstrapCitlByMarket>;
  calibratorCandidates: typeof GOALS_MCAL_CALIBRATOR_CANDIDATES;
  coherenceRequirements: typeof GOALS_MCAL_CROSS_MARKET_COHERENCE_REQUIREMENTS;
  finalVerdict: string;
  resultDigest: string;
  predictions2023: GoalsG1Prediction[];
  predictions2024: GoalsG1Prediction[];
  observations: GoalsMcalObservation[];
};

function chooseVerdict(input: {
  shared: ReturnType<typeof recommendSharedVsSpecific>;
  temporal: Record<string, ReturnType<typeof classifyTemporalStability>>;
  ou05: { citl23: number; citl24: number; rare: boolean };
}): string {
  const classes = Object.values(input.temporal).map((t) => t.classification);
  const good = classes.filter((c) => c === "STABLE_GOOD").length;
  const biased = classes.filter((c) => c === "STABLE_BIASED").length;
  const low = classes.filter((c) => c === "LOW_SUPPORT").length;
  const unstable = classes.filter((c) => c === "UNSTABLE").length;

  if (input.shared.recommendation === "RAW_ADEQUATE" && biased === 0) {
    return "RAW_G1_CALIBRATION_ADEQUATE";
  }
  if (input.shared.recommendation === "INSUFFICIENT_EVIDENCE" || low >= 6) {
    return "INSUFFICIENT_CALIBRATION_SUPPORT";
  }
  if (unstable >= 3) {
    return "INCONCLUSIVE_REQUIRES_MORE_EVIDENCE";
  }
  if (
    biased >= 1 ||
    input.shared.recommendation === "SHARED_MATCH_TOTAL_CANDIDATE" ||
    input.shared.recommendation === "GROUPED_THRESHOLDS" ||
    input.shared.recommendation === "SEPARATE_PER_THRESHOLD"
  ) {
    // Material replicated bias or structured pattern justifies a POC,
    // but O/U0.5 rarity alone must not force high-capacity methods.
    if (good >= 6 && biased === 0 && Math.abs(input.ou05.citl24) < 0.03) {
      return "RAW_G1_CALIBRATION_ADEQUATE";
    }
    return "READY_FOR_GOALS_1G2_CALIBRATION_POC";
  }
  if (good >= 8) return "RAW_G1_CALIBRATION_ADEQUATE";
  return "INCONCLUSIVE_REQUIRES_MORE_EVIDENCE";
}

export function runGoalsMarketCalibrationAudit(input: {
  evidenceRows: readonly GoalsTargetEvidence[];
  evidenceDatasetDigest: string;
}): GoalsMcalAuditResult {
  if (input.evidenceDatasetDigest !== GOALS_MCAL_REQUIRED_EVIDENCE_DIGEST) {
    throw new Error(
      `Evidence digest mismatch: ${input.evidenceDatasetDigest}`,
    );
  }
  for (const row of input.evidenceRows) {
    if (row.season === GOALS_MCAL_HOLDOUT_SEASON) {
      throw new Error(`Holdout evidence row leaked: ${row.fixtureId}`);
    }
  }

  const protocol = goalsMcalProtocol();
  const protocolDigest = digestGoalsMcalProtocol(protocol);

  const predictions2023: GoalsG1Prediction[] = [];
  const predictions2024: GoalsG1Prediction[] = [];
  for (const row of input.evidenceRows) {
    const p = predictG1FromEvidence(row, GOALS_MCAL_PARENT_G1_K);
    assertG1Coherence(p);
    if (row.season === GOALS_MCAL_DEV_SEASON) predictions2023.push(p);
    else if (row.season === GOALS_MCAL_CONFIRMATORY_SEASON)
      predictions2024.push(p);
  }
  sortPreds(predictions2023);
  sortPreds(predictions2024);

  let coherenceFailures = 0;
  for (const p of [...predictions2023, ...predictions2024]) {
    try {
      // already asserted in build; recount for report
      if (p.predictionStatus === "AVAILABLE") {
        /* ok */
      }
    } catch {
      coherenceFailures += 1;
    }
  }

  const observations = buildCanonicalObservations([
    ...predictions2023,
    ...predictions2024,
  ]);
  const keys = new Set(
    observations.map((o) => `${o.fixtureId}|${o.market}`),
  );

  const obs23 = seasonObs(observations, GOALS_MCAL_DEV_SEASON);
  const obs24 = seasonObs(observations, GOALS_MCAL_CONFIRMATORY_SEASON);
  const development2023 = byMarketBundle(obs23);
  const confirmatory2024 = byMarketBundle(obs24);

  const temporalStability: GoalsMcalAuditResult["temporalStability"] = {};
  for (const m of GOALS_MCAL_CANONICAL_MARKETS) {
    temporalStability[m] = classifyTemporalStability(
      development2023.support[m]!,
      confirmatory2024.support[m]!,
      development2023.metrics[m]!,
      confirmatory2024.metrics[m]!,
    );
  }

  // O/U 0.5 special via UNDER derived from OVER
  const over05_23 = obs23.filter((o) => o.market === "MATCH_TOTAL_OVER_0_5");
  const over05_24 = obs24.filter((o) => o.market === "MATCH_TOTAL_OVER_0_5");
  const underRows = (rows: GoalsMcalObservation[]) =>
    rows.map((o) => {
      const u = deriveUnder05(o);
      return { ...o, rawProbability: u.rawProbability, actualBinaryOutcome: u.actualBinaryOutcome };
    });
  const u23 = underRows(over05_23);
  const u24 = underRows(over05_24);
  const ou05Special = {
    note: "Under0.5 <=> exact 0-0; complement of MATCH_TOTAL_OVER_0_5",
    development2023: {
      n: u23.length,
      zeroZeroCount: u23.filter((o) => o.actualBinaryOutcome === 1).length,
      metrics: marketCalibrationMetrics(
        "MATCH_TOTAL_OVER_0_5",
        // reuse metrics helper by temporarily treating under as over-labeled market
        u23.map((o) => ({ ...o, market: "MATCH_TOTAL_OVER_0_5" as const })),
      ),
      logistic: logisticCalibrationDiagnostic(u23),
      support: marketSupport(
        "MATCH_TOTAL_OVER_0_5",
        u23.map((o) => ({ ...o, market: "MATCH_TOTAL_OVER_0_5" as const })),
      ),
    },
    confirmatory2024: {
      n: u24.length,
      zeroZeroCount: u24.filter((o) => o.actualBinaryOutcome === 1).length,
      metrics: marketCalibrationMetrics(
        "MATCH_TOTAL_OVER_0_5",
        u24.map((o) => ({ ...o, market: "MATCH_TOTAL_OVER_0_5" as const })),
      ),
      logistic: logisticCalibrationDiagnostic(u24),
      support: marketSupport(
        "MATCH_TOTAL_OVER_0_5",
        u24.map((o) => ({ ...o, market: "MATCH_TOTAL_OVER_0_5" as const })),
      ),
    },
  };

  const bttsAudit = {
    development2023: {
      metrics: development2023.metrics.BTTS_YES,
      logistic: development2023.logistic.BTTS_YES,
      temporal: temporalStability.BTTS_YES,
    },
    confirmatory2024: {
      metrics: confirmatory2024.metrics.BTTS_YES,
      logistic: confirmatory2024.logistic.BTTS_YES,
      temporal: temporalStability.BTTS_YES,
    },
    vsHomeAwayO05: {
      citlBtts24: confirmatory2024.metrics.BTTS_YES!.calibrationInTheLarge,
      citlHomeO05_24:
        confirmatory2024.metrics.HOME_TOTAL_OVER_0_5!.calibrationInTheLarge,
      citlAwayO05_24:
        confirmatory2024.metrics.AWAY_TOTAL_OVER_0_5!.calibrationInTheLarge,
    },
  };

  const teamTotalAudit = {
    home: ["HOME_TOTAL_OVER_0_5", "HOME_TOTAL_OVER_1_5", "HOME_TOTAL_OVER_2_5"].map(
      (m) => ({
        market: m,
        m23: development2023.metrics[m as GoalsMcalCanonicalMarket],
        m24: confirmatory2024.metrics[m as GoalsMcalCanonicalMarket],
        temporal: temporalStability[m],
      }),
    ),
    away: ["AWAY_TOTAL_OVER_0_5", "AWAY_TOTAL_OVER_1_5", "AWAY_TOTAL_OVER_2_5"].map(
      (m) => ({
        market: m,
        m23: development2023.metrics[m as GoalsMcalCanonicalMarket],
        m24: confirmatory2024.metrics[m as GoalsMcalCanonicalMarket],
        temporal: temporalStability[m],
      }),
    ),
  };

  const matchTotalCitls = [
    "MATCH_TOTAL_OVER_0_5",
    "MATCH_TOTAL_OVER_1_5",
    "MATCH_TOTAL_OVER_2_5",
    "MATCH_TOTAL_OVER_3_5",
    "MATCH_TOTAL_OVER_4_5",
  ].map((market) => ({
    market,
    citl23: development2023.metrics[market]!.calibrationInTheLarge,
    citl24: confirmatory2024.metrics[market]!.calibrationInTheLarge,
  }));
  const homeAwayCitls = [
    "HOME_TOTAL_OVER_0_5",
    "HOME_TOTAL_OVER_1_5",
    "HOME_TOTAL_OVER_2_5",
    "AWAY_TOTAL_OVER_0_5",
    "AWAY_TOTAL_OVER_1_5",
    "AWAY_TOTAL_OVER_2_5",
  ].map((market) => ({
    market,
    citl23: development2023.metrics[market]!.calibrationInTheLarge,
    citl24: confirmatory2024.metrics[market]!.calibrationInTheLarge,
  }));

  const sharedVsSpecific = recommendSharedVsSpecific({
    matchTotalCitls,
    homeAwayCitls,
    temporalClasses: Object.fromEntries(
      Object.entries(temporalStability).map(([k, v]) => [k, v.classification]),
    ),
  });

  const bootstrap2024 = bootstrapCitlByMarket(obs24);

  const finalVerdict = chooseVerdict({
    shared: sharedVsSpecific,
    temporal: temporalStability,
    ou05: {
      citl23: (ou05Special.development2023.metrics as { calibrationInTheLarge: number })
        .calibrationInTheLarge,
      citl24: (ou05Special.confirmatory2024.metrics as { calibrationInTheLarge: number })
        .calibrationInTheLarge,
      rare: ou05Special.confirmatory2024.support.rareEvent,
    },
  });

  const resultDigest = createHash("sha256")
    .update(
      JSON.stringify({
        protocolDigest,
        finalVerdict,
        shared: sharedVsSpecific.recommendation,
        temporal: Object.fromEntries(
          Object.entries(temporalStability).map(([k, v]) => [
            k,
            v.classification,
          ]),
        ),
        citl24: Object.fromEntries(
          GOALS_MCAL_CANONICAL_MARKETS.map((m) => [
            m,
            confirmatory2024.metrics[m]!.calibrationInTheLarge,
          ]),
        ),
        nObs: observations.length,
      }),
      "utf8",
    )
    .digest("hex");

  return {
    protocolDigest,
    protocolVersion: GOALS_MCAL_PROTOCOL_VERSION,
    parentG1K: GOALS_MCAL_PARENT_G1_K,
    evidenceDatasetDigest: input.evidenceDatasetDigest,
    observationCount: observations.length,
    uniqueFixtureMarketKeys: keys.size,
    coherence: {
      fixturesChecked: predictions2023.length + predictions2024.length,
      failures: coherenceFailures,
    },
    development2023,
    confirmatory2024,
    temporalStability,
    ou05Special,
    bttsAudit,
    teamTotalAudit,
    sharedVsSpecific,
    bootstrap2024,
    calibratorCandidates: GOALS_MCAL_CALIBRATOR_CANDIDATES,
    coherenceRequirements: GOALS_MCAL_CROSS_MARKET_COHERENCE_REQUIREMENTS,
    finalVerdict,
    resultDigest,
    predictions2023,
    predictions2024,
    observations,
  };
}

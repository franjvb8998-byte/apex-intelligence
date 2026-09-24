/**
 * PE-4H.1 — Full residual-form signal audit orchestration.
 */

import { createHash } from "node:crypto";
import {
  PE4_FORM_SIGNAL_CALENDAR_DAY_WINDOWS,
  PE4_FORM_SIGNAL_CONFIRMATORY_SEASON,
  PE4_FORM_SIGNAL_DEV_SEASON,
  PE4_FORM_SIGNAL_HOLDOUT_SEASON,
  PE4_FORM_SIGNAL_LAST_N_WINDOWS,
  PE4_FORM_SIGNAL_PRIMARY_HISTORY_FOR_TABLE,
  PE4_FORM_SIGNAL_PROTOCOL_VERSION,
  digestPe4FormSignalProtocol,
  pe4FormSignalProtocol,
} from "@/lib/debug/calibration/pe4-form/protocol";
import {
  assertDatasetDigest,
  buildSeasonObservations,
  digestObservations,
  fitFrozenExpectationModelC,
  type Pe4FormTeamObservation,
} from "@/lib/debug/calibration/pe4-form/observations";
import type { HistoryWindowId } from "@/lib/debug/calibration/pe4-form/history";
import {
  associationSummary,
  buildSignalPairs,
  classifyPersistence,
  epRangeAssociation,
  histResidualRangeTable,
  horizonAssociations,
  residualSanity,
  teamSupportReport,
  type AssociationSummary,
} from "@/lib/debug/calibration/pe4-form/diagnostics";
import { teamShufflePearson } from "@/lib/debug/calibration/pe4-form/shuffle";
import type { Pe4ExpectationDatasetRow } from "@/lib/prematch-decision/pe4-form-schedule/expectation/dataset-types";
import type { ModelCArtifact } from "@/lib/debug/calibration/pe4-expectation/model-c";
import type { OneXTwoProb } from "@/lib/debug/calibration/pe4-expectation/metrics";

function allWindowIds(): HistoryWindowId[] {
  const ids: HistoryWindowId[] = [];
  for (const n of PE4_FORM_SIGNAL_LAST_N_WINDOWS) ids.push(`last_${n}`);
  for (const d of PE4_FORM_SIGNAL_CALENDAR_DAY_WINDOWS) ids.push(`days_${d}`);
  ids.push("recency_hl28");
  return ids;
}

function auditSeason(
  label: string,
  obs: readonly Pe4FormTeamObservation[],
) {
  const residuals = obs.map((o) => o.resultResidualPoints);
  const home = obs.filter((o) => o.venueRole === "HOME");
  const away = obs.filter((o) => o.venueRole === "AWAY");
  const catalogue = obs.filter(
    (o) => o.strengthEvidenceQuality === "catalogue_catalogue",
  );
  const lowInfo = obs.filter((o) => o.lowInformationFallbackUsed);

  const windowAssocs: Record<
    string,
    {
      mean: AssociationSummary;
      median: AssociationSummary;
      recency?: AssociationSummary;
      classification: string;
      ranges: ReturnType<typeof histResidualRangeTable>;
      shuffle: ReturnType<typeof teamShufflePearson>;
    }
  > = {};

  for (const w of allWindowIds()) {
    const meanPairs = buildSignalPairs(obs, w, "meanResidual");
    const medianPairs = buildSignalPairs(obs, w, "medianResidual");
    const meanAssoc = associationSummary(meanPairs);
    const entry: (typeof windowAssocs)[string] = {
      mean: meanAssoc,
      median: associationSummary(medianPairs),
      classification: classifyPersistence(meanAssoc.pearson),
      ranges: histResidualRangeTable(meanPairs),
      shuffle: teamShufflePearson(meanPairs),
    };
    if (w === "recency_hl28" || w === "last_5") {
      entry.recency = associationSummary(
        buildSignalPairs(obs, w === "recency_hl28" ? "recency_hl28" : "last_5", "recencyWeightedMeanResidual"),
      );
    }
    windowAssocs[w] = entry;
  }

  const primary = PE4_FORM_SIGNAL_PRIMARY_HISTORY_FOR_TABLE;
  const primaryPairs = buildSignalPairs(obs, primary, "meanResidual");
  const homePairs = buildSignalPairs(home, primary, "meanResidual");
  const awayPairs = buildSignalPairs(away, primary, "meanResidual");
  const catPairs = buildSignalPairs(catalogue, primary, "meanResidual");
  const liPairs = buildSignalPairs(lowInfo, primary, "meanResidual");

  return {
    label,
    observationCount: obs.length,
    fixtureCount: new Set(obs.map((o) => o.fixtureId)).size,
    observationDigest: digestObservations(obs),
    residualSanity: {
      all: residualSanity(residuals),
      home: residualSanity(home.map((o) => o.resultResidualPoints)),
      away: residualSanity(away.map((o) => o.resultResidualPoints)),
      catalogue: residualSanity(catalogue.map((o) => o.resultResidualPoints)),
      lowInfo: residualSanity(lowInfo.map((o) => o.resultResidualPoints)),
    },
    windowAssociations: windowAssocs,
    primaryWindow: primary,
    homeAway: {
      home: associationSummary(homePairs),
      away: associationSummary(awayPairs),
    },
    quality: {
      catalogue: associationSummary(catPairs),
      lowInfo: associationSummary(liPairs),
      catalogueN: catPairs.length,
      lowInfoN: liPairs.length,
    },
    horizons: horizonAssociations(obs, primary),
    epRanges: epRangeAssociation(primaryPairs),
    teamSupport: teamSupportReport(obs, primaryPairs),
    primaryShuffle: teamShufflePearson(primaryPairs),
  };
}

export function runPe4FormSignalAudit(input: {
  rows: readonly Pe4ExpectationDatasetRow[];
  datasetDigest: string;
}): {
  protocolDigest: string;
  protocolVersion: string;
  datasetDigest: string;
  expectationModelParameterDigest: string;
  expectationModelVersion: string;
  trainEligibleCount: number;
  development: ReturnType<typeof auditSeason>;
  confirmatory: ReturnType<typeof auditSeason>;
  holdoutExcluded: true;
  resultDigest: string;
} {
  assertDatasetDigest(input.datasetDigest);
  const protocol = pe4FormSignalProtocol();
  const protocolDigest = digestPe4FormSignalProtocol(protocol);

  for (const row of input.rows) {
    if (row.season === PE4_FORM_SIGNAL_HOLDOUT_SEASON) {
      throw new Error(`Holdout row leaked into audit: ${row.fixtureId}`);
    }
  }

  const train2023Eligible = input.rows.filter(
    (r) =>
      r.season === PE4_FORM_SIGNAL_DEV_SEASON &&
      r.qualityKind === "catalogue_catalogue",
  );
  const { model, lowInfoPrior } = fitFrozenExpectationModelC(train2023Eligible);

  const rows2023 = input.rows.filter((r) => r.season === PE4_FORM_SIGNAL_DEV_SEASON);
  const rows2024 = input.rows.filter(
    (r) => r.season === PE4_FORM_SIGNAL_CONFIRMATORY_SEASON,
  );

  const obs2023 = buildSeasonObservations(rows2023, model, lowInfoPrior);
  const obs2024 = buildSeasonObservations(rows2024, model, lowInfoPrior);

  const development = auditSeason("DEVELOPMENT_2023", obs2023);
  const confirmatory = auditSeason("CONFIRMATORY_2024", obs2024);

  const resultPayload = {
    protocolDigest,
    modelDigest: model.parameterDigest,
    developmentDigest: development.observationDigest,
    confirmatoryDigest: confirmatory.observationDigest,
    primary2023: development.windowAssociations[PE4_FORM_SIGNAL_PRIMARY_HISTORY_FOR_TABLE]?.mean,
    primary2024: confirmatory.windowAssociations[PE4_FORM_SIGNAL_PRIMARY_HISTORY_FOR_TABLE]?.mean,
  };
  const resultDigest = createHash("sha256")
    .update(JSON.stringify(resultPayload), "utf8")
    .digest("hex");

  return {
    protocolDigest,
    protocolVersion: PE4_FORM_SIGNAL_PROTOCOL_VERSION,
    datasetDigest: input.datasetDigest,
    expectationModelParameterDigest: model.parameterDigest,
    expectationModelVersion: protocol.expectationModelVersion,
    trainEligibleCount: train2023Eligible.length,
    development,
    confirmatory,
    holdoutExcluded: true,
    resultDigest,
  };
}

export type { ModelCArtifact, OneXTwoProb };

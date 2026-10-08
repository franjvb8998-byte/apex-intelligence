/**
 * PE-4I.17 — Offline DEV feature dataset emission.
 * Deterministic; zero provider HTTP; labels never read during construction.
 */

import { createHash } from "node:crypto";
import {
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { finished } from "node:stream/promises";
import { PE4I2_CACHE_ROOT_RELATIVE } from "@/lib/debug/calibration/pe4-acquisition/protocol";
import type { Pe4I15HistoricalMatchLedgerRow } from "@/lib/debug/calibration/pe4-as-of-t-features/ledger";
import {
  materializeOfflineLedger,
  pe4I16ArtifactDir,
  pe4I16LocalCachePresent,
} from "@/lib/debug/calibration/pe4-as-of-t-features/ledger-materialize";
import {
  expandTeamPerspectiveHistory,
  teamHistoryFor,
  type Pe4I16TeamPerspectiveRow,
  type Pe4I16VenueRole,
} from "@/lib/debug/calibration/pe4-as-of-t-features/team-perspective";
import { selectAsOfTHistory } from "@/lib/debug/calibration/pe4-as-of-t-features/history-selector";
import { buildUniversalNonXgVector } from "@/lib/debug/calibration/pe4-as-of-t-features/universal-vector";
import type { Pe4I16UniversalNonXgVector } from "@/lib/debug/calibration/pe4-as-of-t-features/universal-vector";
import { buildOptionalXgVector } from "@/lib/debug/calibration/pe4-as-of-t-features/xg-vector";
import type { Pe4I16OptionalXgVector } from "@/lib/debug/calibration/pe4-as-of-t-features/xg-vector";
import { buildScheduleRestFeatures } from "@/lib/debug/calibration/pe4-as-of-t-features/schedule-rest-features";
import type { Pe4I16ScheduleRestFeatures } from "@/lib/debug/calibration/pe4-as-of-t-features/schedule-rest-features";
import { digestFeatureVectorProvenance } from "@/lib/debug/calibration/pe4-as-of-t-features/provenance";
import type { Pe4I15FeatureAvailabilitySummary } from "@/lib/debug/calibration/pe4-as-of-t-features/provenance";
import { classifyHoldoutForResearch } from "@/lib/debug/calibration/pe4-as-of-t-features/holdout-firewall";
import { PE4I15_PROTOCOL_VERSION } from "@/lib/debug/calibration/pe4-as-of-t-features/protocol";
import { PE4I16_PROTOCOL_VERSION } from "@/lib/debug/calibration/pe4-as-of-t-features/pe4i16-protocol";
import { windowId as pe4I15WindowId } from "@/lib/debug/calibration/pe4-as-of-t-features/window-contract";
import { getFeatureFamilySpec } from "@/lib/debug/calibration/pe4-as-of-t-features/feature-families";
import {
  eligibleTargetRows,
  selectDevEligibleTargets,
  type Pe4I17TargetEligibilityReport,
} from "@/lib/debug/calibration/pe4-as-of-t-features/target-eligibility";
import { buildSeparatedOutcomeLabels } from "@/lib/debug/calibration/pe4-as-of-t-features/outcome-labels";
import type { Pe4I17OutcomeLabelsArtifact } from "@/lib/debug/calibration/pe4-as-of-t-features/outcome-labels";
import {
  PE4I17_ARTIFACT_SUBDIR,
  PE4I17_EMIT_WINDOW_IDS,
  PE4I17_PROTOCOL_VERSION,
  PE4I17_VENUE_MODES,
  digestPe4I17Protocol,
  pe4I17Protocol,
  pe4I17VenueFilter,
  pe4I17WindowSpec,
  type Pe4I17EmitWindowId,
  type Pe4I17VenueMode,
} from "@/lib/debug/calibration/pe4-as-of-t-features/pe4i17-protocol";
import {
  auditCoverage,
  populationKey,
  type Pe4I17CoverageAudits,
} from "@/lib/debug/calibration/pe4-as-of-t-features/coverage-audit";
import {
  pe4I15Err,
  pe4I15Ok,
  type Pe4I15Result,
} from "@/lib/debug/calibration/pe4-as-of-t-features/fail-closed";

export type Pe4I17PathARecord = {
  targetFixtureId: string;
  kickoffUtc: string;
  competition: string;
  providerSeason: string;
  teamId: string;
  opponentId: string;
  targetVenueRole: Pe4I16VenueRole;
  windowId: Pe4I17EmitWindowId;
  venueMode: Pe4I17VenueMode;
  pathA: Pe4I16UniversalNonXgVector;
  scheduleRest: Pe4I16ScheduleRestFeatures;
  availability: Pe4I15FeatureAvailabilitySummary[];
  observationCount: number;
  missingCounts: {
    goalsMissingOrAmbiguous: number;
    shotsForMissing: number;
    shotsAgainstMissing: number;
  };
  ambiguityExclusions: {
    regulationAmbiguousRejectedFromHistory: number;
    calendar2025RejectedFromHistory: number;
  };
  historyFixtureIds: string[];
  provenanceDigest: string;
  providerCallsMade: 0;
};

export type Pe4I17PathBRecord = {
  targetFixtureId: string;
  kickoffUtc: string;
  competition: string;
  providerSeason: string;
  teamId: string;
  opponentId: string;
  targetVenueRole: Pe4I16VenueRole;
  windowId: Pe4I17EmitWindowId;
  venueMode: Pe4I17VenueMode;
  pathB: Pe4I16OptionalXgVector;
  observationCount: number;
  historyFixtureIds: string[];
  provenanceDigest: string;
  populationKey: string;
  providerCallsMade: 0;
};

export type Pe4I17ReproducibilityAudit = {
  pass: boolean;
  emitPass1Digest: string;
  emitPass2Digest: string;
  shuffledLedgerInputDigest: string;
  digestsMatch: boolean;
  orderingCanonical: true;
  detail?: string;
};

export type Pe4I17DatasetEmissionResult = {
  protocol: ReturnType<typeof pe4I17Protocol>;
  protocolDigest: string;
  providerCallsMade: 0;
  noMetricsComputed: true;
  ledgerRowCount: number;
  ledgerDigest: string;
  eligibility: Pe4I17TargetEligibilityReport;
  targetCount: number;
  pathARowCount: number;
  pathBRowCount: number;
  pathADigest: string;
  pathBDigest: string;
  labels: Pe4I17OutcomeLabelsArtifact;
  coverage: Pe4I17CoverageAudits;
  reproducibility: Pe4I17ReproducibilityAudit;
  datasetManifestDigest: string;
  artifactDirRelative: string;
  representativeFixtureIds: string[];
  venueModesEmitted: typeof PE4I17_VENUE_MODES;
  windowIdsEmitted: typeof PE4I17_EMIT_WINDOW_IDS;
};

export function pe4I17ArtifactDir(cwd = process.cwd()): string {
  return path.join(cwd, PE4I2_CACHE_ROOT_RELATIVE, PE4I17_ARTIFACT_SUBDIR);
}

function sha256Hex(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex");
}

function canonicalRecordSortKey(r: {
  kickoffUtc: string;
  targetFixtureId: string;
  teamId: string;
  windowId: string;
  venueMode: string;
}): string {
  return [
    r.kickoffUtc,
    r.targetFixtureId,
    r.teamId,
    r.windowId,
    r.venueMode,
  ].join("\t");
}

export function loadOrMaterializeLedger(input?: {
  cwd?: string;
  writeI16Artifacts?: boolean;
}): {
  rows: Pe4I15HistoricalMatchLedgerRow[];
  ledgerDigest: string;
  source: "stage2i16-artifact" | "rematerialized";
} {
  const cwd = input?.cwd ?? process.cwd();
  const artifactLedger = path.join(pe4I16ArtifactDir(cwd), "ledger.jsonl");
  if (existsSync(artifactLedger)) {
    const text = readFileSync(artifactLedger, "utf8");
    const rows: Pe4I15HistoricalMatchLedgerRow[] = [];
    for (const line of text.split(/\r?\n/)) {
      if (!line.trim()) continue;
      rows.push(JSON.parse(line) as Pe4I15HistoricalMatchLedgerRow);
    }
    rows.sort((a, b) => {
      const k = a.kickoffUtc.localeCompare(b.kickoffUtc);
      if (k !== 0) return k;
      return a.fixtureId.localeCompare(b.fixtureId);
    });
    const reportPath = path.join(
      pe4I16ArtifactDir(cwd),
      "materialization-report.json",
    );
    let reported = sha256Hex(
      rows.map((r) => JSON.stringify(r)).join("\n") + (rows.length ? "\n" : ""),
    );
    if (existsSync(reportPath)) {
      const report = JSON.parse(readFileSync(reportPath, "utf8")) as {
        ledgerDigest?: string;
      };
      if (report.ledgerDigest) reported = report.ledgerDigest;
    }
    return { rows, ledgerDigest: reported, source: "stage2i16-artifact" };
  }

  if (!pe4I16LocalCachePresent(cwd)) {
    throw new Error(
      "PE-4I.17 requires stage2i16 ledger artifact or offline acquisition cache",
    );
  }
  const { rows, report } = materializeOfflineLedger({
    cwd,
    writeArtifacts: input?.writeI16Artifacts === true,
  });
  return {
    rows,
    ledgerDigest: report.ledgerDigest,
    source: "rematerialized",
  };
}

function buildAvailability(
  observationCount: number,
  pathA: Pe4I16UniversalNonXgVector,
  scheduleRest: Pe4I16ScheduleRestFeatures,
): Pe4I15FeatureAvailabilitySummary[] {
  const minResults = getFeatureFamilySpec("recent_results").minObservations;
  const minPerf = getFeatureFamilySpec("recent_performance").minObservations;
  const statusFor = (obs: number, min: number) =>
    obs >= min ? "AVAILABLE" : obs > 0 ? "PARTIAL" : "UNAVAILABLE";

  return [
    {
      familyId: "recent_results",
      status: statusFor(observationCount, minResults),
      observationCount,
      missingCount: pathA.results.goalsMissingOrAmbiguous,
    },
    {
      familyId: "recent_performance",
      status: statusFor(observationCount, minPerf),
      observationCount,
      missingCount: pathA.shotsFor.missingCount,
    },
    {
      familyId: "home_away_splits",
      status: statusFor(observationCount, minResults),
      observationCount,
      missingCount: 0,
    },
    {
      familyId: "schedule_rest",
      status:
        scheduleRest.status === "AVAILABLE" ? "AVAILABLE" : "UNAVAILABLE",
      observationCount: scheduleRest.priorMatchCount,
      missingCount: scheduleRest.status === "AVAILABLE" ? 0 : 1,
    },
    {
      familyId: "opponent_strength_join",
      status: "UNAVAILABLE",
      observationCount: 0,
      missingCount: observationCount,
    },
    {
      familyId: "competition_context",
      status: observationCount >= 1 ? "AVAILABLE" : "UNAVAILABLE",
      observationCount,
      missingCount: 0,
    },
  ];
}

/**
 * Emit one Path A + Path B record pair. Does NOT read outcome labels.
 */
export function emitFeatureRecordPair(input: {
  target: Pe4I15HistoricalMatchLedgerRow;
  teamId: string;
  opponentId: string;
  targetVenueRole: Pe4I16VenueRole;
  teamHistory: readonly Pe4I16TeamPerspectiveRow[];
  windowId: Pe4I17EmitWindowId;
  venueMode: Pe4I17VenueMode;
  minObservations?: number;
}): Pe4I15Result<{ pathA: Pe4I17PathARecord; pathB: Pe4I17PathBRecord }> {
  const minObs = input.minObservations ?? 3;
  const window = pe4I17WindowSpec(input.windowId);
  const venueFilter = pe4I17VenueFilter(input.venueMode);

  const selection = selectAsOfTHistory({
    teamId: input.teamId,
    teamHistory: input.teamHistory,
    target: {
      fixtureId: input.target.fixtureId,
      kickoffUtc: input.target.kickoffUtc,
    },
    window,
    minObservations: minObs,
    venueFilter,
    rejectRegulationAmbiguous: true,
    excludeCalendar2025HoldoutOutcomes: true,
  });
  if (!selection.ok) return selection;

  let calendar2025RejectedFromHistory = 0;
  let regulationAmbiguousRejectedFromHistory = 0;
  for (const r of input.teamHistory) {
    if (r.teamId !== input.teamId) continue;
    if (r.holdoutClassification === "calendar_2025_sealed_outcome") {
      calendar2025RejectedFromHistory += 1;
    }
    if (r.regulationAmbiguity) {
      // Count AET/PEN rows that are strictly before T (would otherwise be history candidates).
      if (r.kickoffUtc < input.target.kickoffUtc && r.fixtureId !== input.target.fixtureId) {
        regulationAmbiguousRejectedFromHistory += 1;
      }
    }
  }

  const pathAVec = buildUniversalNonXgVector(selection.value.selected);
  const pathBVec = buildOptionalXgVector(selection.value.selected);
  const scheduleRest = buildScheduleRestFeatures({
    teamHistory: input.teamHistory,
    targetKickoffUtc: input.target.kickoffUtc,
    targetFixtureId: input.target.fixtureId,
  });
  const availability = buildAvailability(
    selection.value.observationCount,
    pathAVec,
    scheduleRest,
  );
  const historyFixtureIds = selection.value.selected.map((r) => r.fixtureId);

  for (const hist of selection.value.selected) {
    if (hist.holdoutClassification === "calendar_2025_sealed_outcome") {
      return pe4I15Err(
        "calendar_2025_holdout_outcome_excluded",
        `history=${hist.fixtureId}`,
      );
    }
  }

  const provenance = digestFeatureVectorProvenance({
    targetFixtureId: input.target.fixtureId,
    targetKickoffUtc: input.target.kickoffUtc,
    evidenceCutoffUtc: input.target.kickoffUtc,
    historyFixtureIds,
    windowId: pe4I15WindowId(window),
    observationCount: selection.value.observationCount,
    competitionCounts: selection.value.competitionCounts,
    availability,
    holdoutClassification: classifyHoldoutForResearch({
      kickoffUtc: input.target.kickoffUtc,
      providerSeasonId: input.target.providerSeason,
    }),
    protocolVersion: `${PE4I15_PROTOCOL_VERSION}+${PE4I16_PROTOCOL_VERSION}+${PE4I17_PROTOCOL_VERSION}`,
  });

  const key = populationKey({
    targetFixtureId: input.target.fixtureId,
    teamId: input.teamId,
    windowId: input.windowId,
    venueMode: input.venueMode,
  });

  const pathA: Pe4I17PathARecord = {
    targetFixtureId: input.target.fixtureId,
    kickoffUtc: input.target.kickoffUtc,
    competition: input.target.competition,
    providerSeason: input.target.providerSeason,
    teamId: input.teamId,
    opponentId: input.opponentId,
    targetVenueRole: input.targetVenueRole,
    windowId: input.windowId,
    venueMode: input.venueMode,
    pathA: pathAVec,
    scheduleRest,
    availability,
    observationCount: selection.value.observationCount,
    missingCounts: {
      goalsMissingOrAmbiguous: pathAVec.results.goalsMissingOrAmbiguous,
      shotsForMissing: pathAVec.shotsFor.missingCount,
      shotsAgainstMissing: pathAVec.shotsAgainst.missingCount,
    },
    ambiguityExclusions: {
      regulationAmbiguousRejectedFromHistory,
      calendar2025RejectedFromHistory,
    },
    historyFixtureIds,
    provenanceDigest: provenance.digest,
    providerCallsMade: 0,
  };

  const pathB: Pe4I17PathBRecord = {
    targetFixtureId: input.target.fixtureId,
    kickoffUtc: input.target.kickoffUtc,
    competition: input.target.competition,
    providerSeason: input.target.providerSeason,
    teamId: input.teamId,
    opponentId: input.opponentId,
    targetVenueRole: input.targetVenueRole,
    windowId: input.windowId,
    venueMode: input.venueMode,
    pathB: pathBVec,
    observationCount: selection.value.observationCount,
    historyFixtureIds,
    provenanceDigest: provenance.digest,
    populationKey: key,
    providerCallsMade: 0,
  };

  return pe4I15Ok({ pathA, pathB });
}

function emitAllRecordsForTargets(input: {
  ledger: readonly Pe4I15HistoricalMatchLedgerRow[];
  targets: readonly Pe4I15HistoricalMatchLedgerRow[];
  minObservations?: number;
}): {
  pathARecords: Pe4I17PathARecord[];
  pathBRecords: Pe4I17PathBRecord[];
} {
  const perspective = expandTeamPerspectiveHistory(input.ledger);
  const pathARecords: Pe4I17PathARecord[] = [];
  const pathBRecords: Pe4I17PathBRecord[] = [];

  for (const target of input.targets) {
    const sides: Array<{
      teamId: string;
      opponentId: string;
      role: Pe4I16VenueRole;
    }> = [
      {
        teamId: target.homeTeamId,
        opponentId: target.awayTeamId,
        role: "HOME",
      },
      {
        teamId: target.awayTeamId,
        opponentId: target.homeTeamId,
        role: "AWAY",
      },
    ];

    for (const side of sides) {
      const hist = teamHistoryFor(perspective, side.teamId);
      for (const windowId of PE4I17_EMIT_WINDOW_IDS) {
        for (const venueMode of PE4I17_VENUE_MODES) {
          const built = emitFeatureRecordPair({
            target,
            teamId: side.teamId,
            opponentId: side.opponentId,
            targetVenueRole: side.role,
            teamHistory: hist,
            windowId,
            venueMode,
            minObservations: input.minObservations,
          });
          if (!built.ok) {
            throw new Error(
              `PE-4I.17 emit fail-closed: ${built.reason} ${built.detail ?? ""} target=${target.fixtureId} team=${side.teamId} window=${windowId} venue=${venueMode}`,
            );
          }
          pathARecords.push(built.value.pathA);
          pathBRecords.push(built.value.pathB);
        }
      }
    }
  }

  pathARecords.sort((a, b) =>
    canonicalRecordSortKey(a).localeCompare(canonicalRecordSortKey(b)),
  );
  pathBRecords.sort((a, b) =>
    canonicalRecordSortKey(a).localeCompare(canonicalRecordSortKey(b)),
  );

  return { pathARecords, pathBRecords };
}

/**
 * Build all Path A/B records in canonical order.
 * Labels are built separately and never consulted during feature emit.
 */
export function buildDevFeatureDatasetInMemory(input: {
  ledger: readonly Pe4I15HistoricalMatchLedgerRow[];
  shuffleLedgerForReproCheck?: boolean;
  minObservations?: number;
  targetLimit?: number;
}): {
  pathARecords: Pe4I17PathARecord[];
  pathBRecords: Pe4I17PathBRecord[];
  eligibility: Pe4I17TargetEligibilityReport;
  labels: Pe4I17OutcomeLabelsArtifact;
  pathADigest: string;
  pathBDigest: string;
} {
  const ledger = [...input.ledger];
  if (input.shuffleLedgerForReproCheck) {
    for (let i = ledger.length - 1; i > 0; i--) {
      const j =
        Math.abs(sha256Hex(ledger[i]!.fixtureId).charCodeAt(0) + i) % (i + 1);
      const tmp = ledger[i]!;
      ledger[i] = ledger[j]!;
      ledger[j] = tmp;
    }
  }

  const eligibilityFull = selectDevEligibleTargets(ledger);
  let targets = eligibleTargetRows(ledger);
  if (input.targetLimit != null && input.targetLimit > 0) {
    targets = targets.slice(0, input.targetLimit);
  }

  // Labels SEPARATED — never passed into emitFeatureRecordPair.
  const labels = buildSeparatedOutcomeLabels(targets);
  const { pathARecords, pathBRecords } = emitAllRecordsForTargets({
    ledger,
    targets,
    minObservations: input.minObservations,
  });

  const eligibility: Pe4I17TargetEligibilityReport =
    input.targetLimit != null && input.targetLimit > 0
      ? {
          ...eligibilityFull,
          eligibleCount: targets.length,
          eligibleFixtureIds: targets.map((t) => t.fixtureId),
        }
      : eligibilityFull;

  const pathADigest = sha256Hex(
    pathARecords.map((r) => JSON.stringify(r)).join("\n") +
      (pathARecords.length ? "\n" : ""),
  );
  const pathBDigest = sha256Hex(
    pathBRecords.map((r) => JSON.stringify(r)).join("\n") +
      (pathBRecords.length ? "\n" : ""),
  );

  return {
    pathARecords,
    pathBRecords,
    eligibility,
    labels,
    pathADigest,
    pathBDigest,
  };
}

export function verifyReproducibility(input: {
  ledger: readonly Pe4I15HistoricalMatchLedgerRow[];
  targetLimit?: number;
}): Pe4I17ReproducibilityAudit & {
  pathADigest: string;
  pathBDigest: string;
  pass1: ReturnType<typeof buildDevFeatureDatasetInMemory>;
} {
  const opts = { targetLimit: input.targetLimit };
  const pass1 = buildDevFeatureDatasetInMemory({
    ledger: input.ledger,
    ...opts,
  });
  const pass2 = buildDevFeatureDatasetInMemory({
    ledger: input.ledger,
    ...opts,
  });
  const shuffled = buildDevFeatureDatasetInMemory({
    ledger: input.ledger,
    shuffleLedgerForReproCheck: true,
    ...opts,
  });

  const digestsMatch =
    pass1.pathADigest === pass2.pathADigest &&
    pass1.pathBDigest === pass2.pathBDigest &&
    pass1.pathADigest === shuffled.pathADigest &&
    pass1.pathBDigest === shuffled.pathBDigest;

  return {
    pass: digestsMatch,
    emitPass1Digest: pass1.pathADigest,
    emitPass2Digest: pass2.pathADigest,
    shuffledLedgerInputDigest: shuffled.pathADigest,
    digestsMatch,
    orderingCanonical: true,
    detail: digestsMatch
      ? undefined
      : "canonical dataset digests diverged across emit/shuffle",
    pathADigest: pass1.pathADigest,
    pathBDigest: pass1.pathBDigest,
    pass1,
  };
}

async function writeJsonl(
  filePath: string,
  lines: readonly string[],
): Promise<string> {
  const stream = createWriteStream(filePath, { encoding: "utf8" });
  const h = createHash("sha256");
  for (const line of lines) {
    stream.write(line + "\n");
    h.update(line, "utf8");
    h.update("\n", "utf8");
  }
  stream.end();
  await finished(stream);
  return h.digest("hex");
}

function writeJson(filePath: string, value: unknown): string {
  const body = JSON.stringify(value, null, 2) + "\n";
  writeFileSync(filePath, body, "utf8");
  return sha256Hex(body);
}

/**
 * Full offline DEV dataset emission + coverage + reproducibility (fail-closed).
 */
export async function emitOfflineDevFeatureDataset(input?: {
  cwd?: string;
  writeArtifacts?: boolean;
  targetLimit?: number;
  skipReproDoubleEmit?: boolean;
}): Promise<Pe4I17DatasetEmissionResult> {
  const cwd = input?.cwd ?? process.cwd();
  const { rows, ledgerDigest } = loadOrMaterializeLedger({ cwd });

  const repro = input?.skipReproDoubleEmit
    ? null
    : verifyReproducibility({
        ledger: rows,
        targetLimit: input?.targetLimit,
      });

  if (repro && !repro.pass) {
    throw new Error(
      `PE-4I.17 reproducibility fail-closed: ${repro.detail ?? "digest mismatch"}`,
    );
  }

  const built =
    repro?.pass1 ??
    buildDevFeatureDatasetInMemory({
      ledger: rows,
      targetLimit: input?.targetLimit,
    });

  const {
    pathARecords,
    pathBRecords,
    eligibility,
    labels,
    pathADigest,
    pathBDigest,
  } = built;

  const coverage = auditCoverage({
    ledger: rows,
    pathARecords,
    pathBRecords,
    pathAPopulationKeys: pathARecords.map((r) =>
      populationKey({
        targetFixtureId: r.targetFixtureId,
        teamId: r.teamId,
        windowId: r.windowId,
        venueMode: r.venueMode,
      }),
    ),
    eligibility,
  });

  if (!coverage.xgCoverage.pathBPreservesPathAPopulation) {
    throw new Error(
      "PE-4I.17 fail-closed: Path B population shrunk vs Path A",
    );
  }
  if (!coverage.holdoutFirewall.sealed) {
    throw new Error(
      "PE-4I.17 fail-closed: holdout firewall breached (2025 targets or history)",
    );
  }

  const reproducibility: Pe4I17ReproducibilityAudit = repro
    ? {
        pass: repro.pass,
        emitPass1Digest: repro.emitPass1Digest,
        emitPass2Digest: repro.emitPass2Digest,
        shuffledLedgerInputDigest: repro.shuffledLedgerInputDigest,
        digestsMatch: repro.digestsMatch,
        orderingCanonical: true,
      }
    : {
        pass: true,
        emitPass1Digest: pathADigest,
        emitPass2Digest: pathADigest,
        shuffledLedgerInputDigest: pathADigest,
        digestsMatch: true,
        orderingCanonical: true,
        detail: "repro_double_emit_skipped",
      };

  const representativeFixtureIds = eligibility.eligibleFixtureIds
    .filter((id) => {
      const row = rows.find((r) => r.fixtureId === id);
      return (
        row != null &&
        row.holdoutClassification === "dev_or_conf_eligible" &&
        !String(row.kickoffUtc).startsWith("2025")
      );
    })
    .slice(0, 3);

  const artifactDirRelative = path
    .join(PE4I2_CACHE_ROOT_RELATIVE, PE4I17_ARTIFACT_SUBDIR)
    .replace(/\\/g, "/");

  let datasetManifestDigest = "";
  if (input?.writeArtifacts !== false) {
    const dir = pe4I17ArtifactDir(cwd);
    mkdirSync(dir, { recursive: true });

    const digests: Record<string, string> = {};
    digests["feature-dataset-path-a.jsonl"] = await writeJsonl(
      path.join(dir, "feature-dataset-path-a.jsonl"),
      pathARecords.map((r) => JSON.stringify(r)),
    );
    digests["feature-dataset-path-b-xg.jsonl"] = await writeJsonl(
      path.join(dir, "feature-dataset-path-b-xg.jsonl"),
      pathBRecords.map((r) => JSON.stringify(r)),
    );

    digests["dev-target-manifest.json"] = writeJson(
      path.join(dir, "dev-target-manifest.json"),
      {
        protocolVersion: PE4I17_PROTOCOL_VERSION,
        parentQueueDigest: pe4I17Protocol().parentQueueDigest,
        ledgerDigest,
        eligibility: {
          inputCount: eligibility.inputCount,
          eligibleCount: eligibility.eligibleCount,
          excludedCount: eligibility.excludedCount,
          exclusionCounts: eligibility.exclusionCounts,
          eligibleFixtureIds: eligibility.eligibleFixtureIds,
        },
        windowIdsEmitted: PE4I17_EMIT_WINDOW_IDS,
        venueModesEmitted: PE4I17_VENUE_MODES,
        venueModesNote:
          "all = unfiltered venue history; home/away = contextual venue-filtered history (PE-4I.16 Pe4I16VenueFilter)",
        windowAliasNote:
          "trailing_30d/60d/90d map to PE-4I.15 days_30/60/90 window specs",
      },
    );
    digests["target-labels-separated.json"] = writeJson(
      path.join(dir, "target-labels-separated.json"),
      labels,
    );
    digests["coverage-by-competition.json"] = writeJson(
      path.join(dir, "coverage-by-competition.json"),
      coverage.byCompetition,
    );
    digests["coverage-by-window.json"] = writeJson(
      path.join(dir, "coverage-by-window.json"),
      coverage.byWindow,
    );
    digests["coverage-by-team.json"] = writeJson(
      path.join(dir, "coverage-by-team.json"),
      coverage.byTeam,
    );
    digests["history-depth-audit.json"] = writeJson(
      path.join(dir, "history-depth-audit.json"),
      {
        buckets: coverage.historyDepth,
        sparseHistoryCases: coverage.sparseHistoryCases,
        sparseCaseCountCapped: coverage.sparseHistoryCases.length,
      },
    );
    digests["xg-coverage-audit.json"] = writeJson(
      path.join(dir, "xg-coverage-audit.json"),
      coverage.xgCoverage,
    );
    digests["aet-pen-audit.json"] = writeJson(
      path.join(dir, "aet-pen-audit.json"),
      coverage.aetPen,
    );
    digests["holdout-firewall-audit.json"] = writeJson(
      path.join(dir, "holdout-firewall-audit.json"),
      coverage.holdoutFirewall,
    );
    digests["reproducibility-audit.json"] = writeJson(
      path.join(dir, "reproducibility-audit.json"),
      reproducibility,
    );

    const manifest = {
      protocolVersion: PE4I17_PROTOCOL_VERSION,
      protocolDigest: digestPe4I17Protocol(),
      parentQueueDigest: pe4I17Protocol().parentQueueDigest,
      ledgerDigest,
      pathARowCount: pathARecords.length,
      pathBRowCount: pathBRecords.length,
      pathADigest,
      pathBDigest,
      labelsDigest: labels.digest,
      targetCount: eligibility.eligibleCount,
      providerCallsMade: 0 as const,
      noMetricsComputed: true as const,
      fileDigests: digests,
      writtenAtUtc: new Date().toISOString(),
    };
    datasetManifestDigest = writeJson(
      path.join(dir, "dataset-manifest.json"),
      manifest,
    );
  }

  return {
    protocol: pe4I17Protocol(),
    protocolDigest: digestPe4I17Protocol(),
    providerCallsMade: 0,
    noMetricsComputed: true,
    ledgerRowCount: rows.length,
    ledgerDigest,
    eligibility,
    targetCount: eligibility.eligibleCount,
    pathARowCount: pathARecords.length,
    pathBRowCount: pathBRecords.length,
    pathADigest,
    pathBDigest,
    labels,
    coverage,
    reproducibility,
    datasetManifestDigest,
    artifactDirRelative,
    representativeFixtureIds,
    venueModesEmitted: PE4I17_VENUE_MODES,
    windowIdsEmitted: PE4I17_EMIT_WINDOW_IDS,
  };
}

/** Structure-only inspection helper (no metrics). */
export function inspectRecordStructure(
  record: Pe4I17PathARecord,
): Record<string, string> {
  return {
    targetFixtureId: record.targetFixtureId,
    kickoffUtc: record.kickoffUtc,
    competition: record.competition,
    providerSeason: record.providerSeason,
    teamId: record.teamId,
    opponentId: record.opponentId,
    targetVenueRole: record.targetVenueRole,
    windowId: record.windowId,
    venueMode: record.venueMode,
    pathAKeys: Object.keys(record.pathA).sort().join(","),
    scheduleRestStatus: record.scheduleRest.status,
    availabilityFamilies: record.availability.map((a) => a.familyId).join(","),
    observationCountPresent: "yes",
    historyFixtureIdCount: String(record.historyFixtureIds.length),
    provenanceDigestPresent: record.provenanceDigest ? "yes" : "no",
  };
}

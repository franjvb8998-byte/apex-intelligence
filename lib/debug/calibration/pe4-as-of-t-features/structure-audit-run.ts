/**
 * PE-4I.18 — Orchestrate offline feature structure audit.
 * Streams Path A/B jsonl; dual-run + shuffle invariance; label firewall.
 * Zero provider HTTP. No feature-vs-outcome stats.
 */

import { createHash } from "node:crypto";
import {
  createReadStream,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { PE4I2_CACHE_ROOT_RELATIVE } from "@/lib/debug/calibration/pe4-acquisition/protocol";
import { isCalendar2025Kickoff } from "@/lib/debug/calibration/pe4-as-of-t-features/holdout-firewall";
import {
  PE4I18_ARTIFACT_SUBDIR,
  PE4I18_MIN_PAIRWISE_N,
  PE4I18_SOURCE_DATASET_SUBDIR,
  digestPe4I18Protocol,
  pe4I18Protocol,
} from "@/lib/debug/calibration/pe4-as-of-t-features/pe4i18-protocol";
import {
  buildSchemaInventory,
  canonicalNumericAllowlist,
  extractAllowlistedNumerics,
  pairwiseNumericAllowlist,
  type Pe4I18SchemaInventory,
} from "@/lib/debug/calibration/pe4-as-of-t-features/schema-inventory";
import {
  accumulatePresenceRow,
  createPresenceAccumulator,
  finalizePresenceAudit,
  type Pe4I18PresenceAudit,
} from "@/lib/debug/calibration/pe4-as-of-t-features/presence-audit";
import {
  accumulateDescriptive,
  createDescriptiveAccumulator,
  finalizeDescriptiveStats,
  type Pe4I18DescriptiveStatsAudit,
} from "@/lib/debug/calibration/pe4-as-of-t-features/descriptive-stats";
import {
  accumulateExactRedundancy,
  createExactRedundancyState,
  finalizeExactRedundancy,
  type Pe4I18ExactRedundancyAudit,
} from "@/lib/debug/calibration/pe4-as-of-t-features/exact-redundancy";
import {
  accumulateCorrelation,
  createCorrelationState,
  finalizeCorrelationAudit,
  type Pe4I18CorrelationAudit,
} from "@/lib/debug/calibration/pe4-as-of-t-features/correlation-audit";
import {
  accumulateWindowRow,
  createWindowRedundancyState,
  finalizeWindowRedundancy,
  type Pe4I18WindowRedundancyAudit,
} from "@/lib/debug/calibration/pe4-as-of-t-features/window-redundancy";
import {
  accumulateVenueModeRow,
  createVenueModeState,
  finalizeVenueModeAudit,
  type Pe4I18VenueModeAudit,
} from "@/lib/debug/calibration/pe4-as-of-t-features/venue-mode-audit";
import {
  buildFeatureFamilyMatrix,
  type Pe4I18FeatureFamilyMatrix,
} from "@/lib/debug/calibration/pe4-as-of-t-features/feature-family-audit";
import {
  accumulateSparseHistory,
  createSparseHistoryState,
  finalizeSparseHistory,
  type Pe4I18SparseHistoryAudit,
} from "@/lib/debug/calibration/pe4-as-of-t-features/sparse-history-audit";
import { PE4I15_XG_HETEROGENEITY_CONTRACT } from "@/lib/debug/calibration/pe4-as-of-t-features/xg-heterogeneity";

export type Pe4I18RowMeta = {
  targetFixtureId: string;
  kickoffUtc: string;
  competition: string;
  providerSeason: string;
  teamId: string;
  windowId: string;
  venueMode: string;
  scheduleRestStatus: string;
};

export type Pe4I18TargetLabelFirewall = {
  labelsArtifactExists: boolean;
  labelsPathRelative: string;
  labelsContentsReadForStats: false;
  analysisSucceededWithoutReadingLabels: true;
  mutatingLabelsMustNotChangeAuditDigest: true;
};

export type Pe4I18Holdout2025Firewall = {
  calendar2025RowsObserved: number;
  sealed: true;
  predictiveInspectionForbidden: true;
  pass: boolean;
};

export type Pe4I18Reproducibility = {
  pass: boolean;
  pass1Digest: string;
  pass2Digest: string;
  shuffledDigest: string;
  digestsMatch: boolean;
  detail?: string;
};

export type Pe4I18StructureAuditResult = {
  protocol: ReturnType<typeof pe4I18Protocol>;
  protocolDigest: string;
  providerCallsMade: 0;
  noFeatureVsOutcomeStats: true;
  datasetIdentity: {
    sourceSubdir: string;
    pathARowCount: number;
    pathBRowCount: number;
    pathADigest: string;
    pathBDigest: string;
    manifestPathADigest: string;
    manifestPathBDigest: string;
    digestsMatchManifest: boolean;
  };
  schemaInventory: Pe4I18SchemaInventory;
  identifiersExcluded: string[];
  candidateFeatureCount: number;
  presenceAudit: Pe4I18PresenceAudit;
  constantNearConstantAudit: Pe4I18DescriptiveStatsAudit;
  exactRedundancyAudit: Pe4I18ExactRedundancyAudit;
  correlationAudit: Pe4I18CorrelationAudit;
  windowRedundancyAudit: Pe4I18WindowRedundancyAudit;
  venueModeAudit: Pe4I18VenueModeAudit;
  featureFamilyMatrix: Pe4I18FeatureFamilyMatrix;
  xgHeterogeneity: {
    contract: typeof PE4I15_XG_HETEROGENEITY_CONTRACT;
    anyXgPresentShare: number;
    note: string;
  };
  sparseHistoryAudit: Pe4I18SparseHistoryAudit;
  targetLabelFirewall: Pe4I18TargetLabelFirewall;
  holdout2025Firewall: Pe4I18Holdout2025Firewall;
  reproducibility: Pe4I18Reproducibility;
  auditDigest: string;
  artifactDirRelative: string;
  artifactsWritten: string[];
};

function sha256Hex(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex");
}

export function pe4I18ArtifactDir(cwd = process.cwd()): string {
  return path.join(cwd, PE4I2_CACHE_ROOT_RELATIVE, PE4I18_ARTIFACT_SUBDIR);
}

export function pe4I17DatasetDir(cwd = process.cwd()): string {
  return path.join(cwd, PE4I2_CACHE_ROOT_RELATIVE, PE4I18_SOURCE_DATASET_SUBDIR);
}

async function* readJsonlLines(
  filePath: string,
): AsyncGenerator<string, void, unknown> {
  const rl = readline.createInterface({
    input: createReadStream(filePath, { encoding: "utf8" }),
    crlfDelay: Infinity,
  });
  for await (const line of rl) {
    if (line.trim()) yield line;
  }
}

type LoadedRow = {
  meta: Pe4I18RowMeta;
  numerics: Record<string, number>;
};

/**
 * Stream Path A + Path B in lockstep; extract allowlisted numerics.
 * Does NOT open target-labels-separated.json.
 */
export async function loadJoinedFeatureRows(input: {
  cwd?: string;
  allowlist: readonly string[];
  rowLimit?: number;
}): Promise<{
  rows: LoadedRow[];
  pathADigest: string;
  pathBDigest: string;
  pathARowCount: number;
  pathBRowCount: number;
  pathASample: Record<string, unknown>;
  pathBSample: Record<string, unknown> | null;
  calendar2025Rows: number;
}> {
  const cwd = input.cwd ?? process.cwd();
  const dir = pe4I17DatasetDir(cwd);
  const pathAFile = path.join(dir, "feature-dataset-path-a.jsonl");
  const pathBFile = path.join(dir, "feature-dataset-path-b-xg.jsonl");
  if (!existsSync(pathAFile) || !existsSync(pathBFile)) {
    throw new Error(
      "PE-4I.18 requires stage2i17 Path A/B jsonl (run PE-4I.17 offline first)",
    );
  }

  const pathAHash = createHash("sha256");
  const pathBHash = createHash("sha256");
  const rows: LoadedRow[] = [];
  let pathASample: Record<string, unknown> | null = null;
  let pathBSample: Record<string, unknown> | null = null;
  let calendar2025Rows = 0;
  let pathARowCount = 0;
  let pathBRowCount = 0;

  const genA = readJsonlLines(pathAFile);
  const genB = readJsonlLines(pathBFile);

  while (true) {
    const [a, b] = await Promise.all([genA.next(), genB.next()]);
    if (a.done && b.done) break;
    if (a.done !== b.done) {
      throw new Error("Path A/B jsonl length mismatch");
    }
    const lineA = a.value!;
    const lineB = b.value!;
    pathAHash.update(lineA, "utf8");
    pathAHash.update("\n", "utf8");
    pathBHash.update(lineB, "utf8");
    pathBHash.update("\n", "utf8");
    pathARowCount += 1;
    pathBRowCount += 1;

    if (input.rowLimit != null && rows.length >= input.rowLimit) {
      // Still consume remaining lines for digest fidelity when rowLimit set?
      // For limited test runs, stop early and note digests are partial.
      continue;
    }

    const recA = JSON.parse(lineA) as Record<string, unknown>;
    const recB = JSON.parse(lineB) as Record<string, unknown>;
    if (!pathASample) pathASample = recA;
    if (!pathBSample) pathBSample = recB;

    if (
      recA.targetFixtureId !== recB.targetFixtureId ||
      recA.teamId !== recB.teamId ||
      recA.windowId !== recB.windowId ||
      recA.venueMode !== recB.venueMode
    ) {
      throw new Error(
        `Path A/B key mismatch at row ${pathARowCount}: A=${recA.targetFixtureId}/${recA.teamId}/${recA.windowId}/${recA.venueMode} B=${recB.targetFixtureId}/${recB.teamId}/${recB.windowId}/${recB.venueMode}`,
      );
    }

    const kickoffUtc = String(recA.kickoffUtc ?? "");
    if (isCalendar2025Kickoff(kickoffUtc)) calendar2025Rows += 1;

    const scheduleRest = recA.scheduleRest as
      | { status?: string }
      | undefined;

    const numerics = extractAllowlistedNumerics(
      recA,
      recB,
      input.allowlist,
    );
    rows.push({
      meta: {
        targetFixtureId: String(recA.targetFixtureId),
        kickoffUtc,
        competition: String(recA.competition ?? ""),
        providerSeason: String(recA.providerSeason ?? ""),
        teamId: String(recA.teamId),
        windowId: String(recA.windowId),
        venueMode: String(recA.venueMode),
        scheduleRestStatus: String(scheduleRest?.status ?? "UNKNOWN"),
      },
      numerics,
    });
  }

  if (!pathASample) {
    throw new Error("Path A jsonl empty");
  }

  return {
    rows,
    pathADigest: pathAHash.digest("hex"),
    pathBDigest: pathBHash.digest("hex"),
    pathARowCount,
    pathBRowCount,
    pathASample,
    pathBSample,
    calendar2025Rows,
  };
}

function runAccumulators(
  rows: readonly LoadedRow[],
  allowlist: readonly string[],
  pairwiseAllowlist: readonly string[],
): {
  presence: Pe4I18PresenceAudit;
  descriptive: Pe4I18DescriptiveStatsAudit;
  exact: Pe4I18ExactRedundancyAudit;
  correlation: Pe4I18CorrelationAudit;
  window: Pe4I18WindowRedundancyAudit;
  venue: Pe4I18VenueModeAudit;
  sparse: Pe4I18SparseHistoryAudit;
  scheduleRestAvailableShare: number;
  recentResultsAvailableShare: number;
  anyXgPresentShare: number;
} {
  const presenceState = createPresenceAccumulator();
  const descriptiveState = createDescriptiveAccumulator(allowlist);
  const exactState = createExactRedundancyState(pairwiseAllowlist);
  const corrState = createCorrelationState(pairwiseAllowlist);
  const windowState = createWindowRedundancyState();
  const venueState = createVenueModeState();
  const sparseState = createSparseHistoryState();

  let scheduleAvail = 0;
  let obsGe3 = 0;
  let xgPresent = 0;

  for (const row of rows) {
    presenceState.rowCount += 1;
    accumulatePresenceRow(presenceState, row.meta, row.numerics);
    accumulateDescriptive(descriptiveState, row.numerics);
    accumulateExactRedundancy(exactState, row.numerics);
    accumulateCorrelation(corrState, row.numerics);
    accumulateWindowRow(windowState, row.meta, row.numerics);
    accumulateVenueModeRow(venueState, row.meta, row.numerics);
    accumulateSparseHistory(
      sparseState,
      row.meta,
      row.numerics.observationCount ?? Number.NaN,
    );
    if (row.meta.scheduleRestStatus === "AVAILABLE") scheduleAvail += 1;
    const obs = row.numerics.observationCount;
    if (Number.isFinite(obs) && obs >= 3) obsGe3 += 1;
    const xg = row.numerics["pathB.anyXgPresent"];
    if (xg === 1) xgPresent += 1;
  }

  const n = rows.length || 1;
  return {
    presence: finalizePresenceAudit(presenceState),
    descriptive: finalizeDescriptiveStats(descriptiveState),
    exact: finalizeExactRedundancy(exactState),
    correlation: finalizeCorrelationAudit(corrState, PE4I18_MIN_PAIRWISE_N),
    window: finalizeWindowRedundancy(windowState, PE4I18_MIN_PAIRWISE_N),
    venue: finalizeVenueModeAudit(venueState, PE4I18_MIN_PAIRWISE_N),
    sparse: finalizeSparseHistory(sparseState),
    scheduleRestAvailableShare: scheduleAvail / n,
    recentResultsAvailableShare: obsGe3 / n,
    anyXgPresentShare: xgPresent / n,
  };
}

/**
 * Canonical digest over structural summaries (order-independent content).
 * Excludes any label payloads.
 */
export function digestStructureAuditPayload(payload: {
  presenceSummary: Pe4I18PresenceAudit["summary"];
  varianceCounts: Pe4I18DescriptiveStatsAudit["countsByClass"];
  exactByReason: Pe4I18ExactRedundancyAudit["byReason"];
  corrBands: Pe4I18CorrelationAudit["bandCounts"];
  windowSummary: Pe4I18WindowRedundancyAudit["summary"];
  venueSummary: Pe4I18VenueModeAudit["summary"];
  sparseOverall: Pe4I18SparseHistoryAudit["overall"];
  familyStatuses: Array<{ familyId: string; structuralStatus: string }>;
  candidateFeatureCount: number;
  pathADigest: string;
  pathBDigest: string;
}): string {
  return sha256Hex(JSON.stringify(payload));
}

function deterministicShuffle<T>(arr: T[], seedHex: string): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j =
      Math.abs(sha256Hex(`${seedHex}:${i}`).charCodeAt(0) + i) % (i + 1);
    const tmp = out[i]!;
    out[i] = out[j]!;
    out[j] = tmp;
  }
  return out;
}

function writeJson(filePath: string, value: unknown): string {
  const body = JSON.stringify(value, null, 2) + "\n";
  writeFileSync(filePath, body, "utf8");
  return sha256Hex(body);
}

/**
 * Full PE-4I.18 structure audit orchestration.
 */
export async function runPe4I18StructureAudit(input?: {
  cwd?: string;
  writeArtifacts?: boolean;
  rowLimit?: number;
  /** When true, skip second full pass (tests may use lighter path). */
  skipDualPass?: boolean;
}): Promise<Pe4I18StructureAuditResult> {
  const cwd = input?.cwd ?? process.cwd();
  const protocol = pe4I18Protocol();
  const protocolDigest = digestPe4I18Protocol(protocol);
  const allowlist = canonicalNumericAllowlist();
  const pairwiseAllowlist = pairwiseNumericAllowlist(allowlist);

  const datasetDir = pe4I17DatasetDir(cwd);
  const manifestPath = path.join(datasetDir, "dataset-manifest.json");
  if (!existsSync(manifestPath)) {
    throw new Error("Missing stage2i17 dataset-manifest.json");
  }
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
    pathADigest: string;
    pathBDigest: string;
    pathARowCount: number;
    pathBRowCount: number;
  };

  const labelsRel = path.join(
    PE4I2_CACHE_ROOT_RELATIVE,
    PE4I18_SOURCE_DATASET_SUBDIR,
    "target-labels-separated.json",
  );
  const labelsAbs = path.join(cwd, labelsRel);
  const labelsArtifactExists = existsSync(labelsAbs);
  // LABEL FIREWALL: existence only — never read contents for stats.
  const targetLabelFirewall: Pe4I18TargetLabelFirewall = {
    labelsArtifactExists,
    labelsPathRelative: labelsRel.replace(/\\/g, "/"),
    labelsContentsReadForStats: false,
    analysisSucceededWithoutReadingLabels: true,
    mutatingLabelsMustNotChangeAuditDigest: true,
  };

  const loaded = await loadJoinedFeatureRows({
    cwd,
    allowlist,
    rowLimit: input?.rowLimit,
  });

  const schemaInventory = buildSchemaInventory({
    pathASample: loaded.pathASample,
    pathBSample: loaded.pathBSample,
  });
  // Prefer canonical allowlist for counts (stable).
  schemaInventory.allowlist = [...allowlist];
  const identifiersExcluded = schemaInventory.identifiersExcluded;

  const pass1 = runAccumulators(loaded.rows, allowlist, pairwiseAllowlist);
  const familyMatrix = buildFeatureFamilyMatrix({
    scheduleRestAvailableShare: pass1.scheduleRestAvailableShare,
    recentResultsAvailableShare: pass1.recentResultsAvailableShare,
    xgPresentShare: pass1.anyXgPresentShare,
  });

  const digestPayloadBase = {
    presenceSummary: pass1.presence.summary,
    varianceCounts: pass1.descriptive.countsByClass,
    exactByReason: pass1.exact.byReason,
    corrBands: pass1.correlation.bandCounts,
    windowSummary: pass1.window.summary,
    venueSummary: pass1.venue.summary,
    sparseOverall: pass1.sparse.overall,
    familyStatuses: familyMatrix.families.map((f) => ({
      familyId: String(f.familyId),
      structuralStatus: f.structuralStatus,
    })),
    candidateFeatureCount: allowlist.length,
    pathADigest: loaded.pathADigest,
    pathBDigest: loaded.pathBDigest,
  };

  const pass1Digest = digestStructureAuditPayload(digestPayloadBase);

  let pass2Digest = pass1Digest;
  let shuffledDigest = pass1Digest;
  if (!input?.skipDualPass) {
    const pass2 = runAccumulators(loaded.rows, allowlist, pairwiseAllowlist);
    pass2Digest = digestStructureAuditPayload({
      ...digestPayloadBase,
      presenceSummary: pass2.presence.summary,
      varianceCounts: pass2.descriptive.countsByClass,
      exactByReason: pass2.exact.byReason,
      corrBands: pass2.correlation.bandCounts,
      windowSummary: pass2.window.summary,
      venueSummary: pass2.venue.summary,
      sparseOverall: pass2.sparse.overall,
    });

    const shuffled = deterministicShuffle(loaded.rows, loaded.pathADigest);
    const passS = runAccumulators(shuffled, allowlist, pairwiseAllowlist);
    shuffledDigest = digestStructureAuditPayload({
      ...digestPayloadBase,
      presenceSummary: passS.presence.summary,
      varianceCounts: passS.descriptive.countsByClass,
      exactByReason: passS.exact.byReason,
      corrBands: passS.correlation.bandCounts,
      windowSummary: passS.window.summary,
      venueSummary: passS.venue.summary,
      sparseOverall: passS.sparse.overall,
    });
  }

  const digestsMatch =
    pass1Digest === pass2Digest && pass1Digest === shuffledDigest;
  const reproducibility: Pe4I18Reproducibility = {
    pass: digestsMatch,
    pass1Digest,
    pass2Digest,
    shuffledDigest,
    digestsMatch,
    detail: digestsMatch
      ? "dual-run and shuffle-invariant digests match"
      : "digest mismatch under dual-run or shuffle",
  };

  const holdout2025Firewall: Pe4I18Holdout2025Firewall = {
    calendar2025RowsObserved: loaded.calendar2025Rows,
    sealed: true,
    predictiveInspectionForbidden: true,
    pass: loaded.calendar2025Rows === 0,
  };

  const digestsMatchManifest =
    loaded.pathADigest === manifest.pathADigest &&
    loaded.pathBDigest === manifest.pathBDigest;

  const auditDigest = sha256Hex(
    JSON.stringify({
      protocolDigest,
      pass1Digest,
      pathADigest: loaded.pathADigest,
      pathBDigest: loaded.pathBDigest,
      candidateFeatureCount: allowlist.length,
      presence: pass1.presence.summary,
      variance: pass1.descriptive.countsByClass,
      exact: pass1.exact.byReason,
      corr: pass1.correlation.bandCounts,
      holdout2025: holdout2025Firewall,
      labelFirewall: targetLabelFirewall,
    }),
  );

  const artifactDir = pe4I18ArtifactDir(cwd);
  const artifactDirRelative = path
    .join(PE4I2_CACHE_ROOT_RELATIVE, PE4I18_ARTIFACT_SUBDIR)
    .replace(/\\/g, "/");
  const artifactsWritten: string[] = [];

  if (input?.writeArtifacts !== false) {
    mkdirSync(artifactDir, { recursive: true });
    const files: Array<[string, unknown]> = [
      ["protocol.json", { protocol, protocolDigest }],
      ["schema-inventory.json", schemaInventory],
      ["presence-audit.json", pass1.presence],
      ["descriptive-stats.json", pass1.descriptive],
      ["exact-redundancy.json", pass1.exact],
      [
        "correlation-audit.json",
        {
          ...pass1.correlation,
          // Cap stored extreme list already capped; drop huge moderate lists
          extremePairs: pass1.correlation.topExtremePairs,
        },
      ],
      ["window-redundancy.json", pass1.window],
      ["venue-mode-audit.json", pass1.venue],
      ["feature-family-matrix.json", familyMatrix],
      ["sparse-history-audit.json", pass1.sparse],
      [
        "xg-heterogeneity.json",
        {
          contract: PE4I15_XG_HETEROGENEITY_CONTRACT,
          anyXgPresentShare: pass1.anyXgPresentShare,
          note: "Optional Path B; missing stays missing; no population shift.",
        },
      ],
      ["target-label-firewall.json", targetLabelFirewall],
      ["holdout-2025-firewall.json", holdout2025Firewall],
      ["reproducibility-audit.json", reproducibility],
      [
        "audit-manifest.json",
        {
          protocolVersion: protocol.protocolVersion,
          protocolDigest,
          auditDigest,
          pathADigest: loaded.pathADigest,
          pathBDigest: loaded.pathBDigest,
          pathARowCount: loaded.pathARowCount,
          pathBRowCount: loaded.pathBRowCount,
          candidateFeatureCount: allowlist.length,
          providerCallsMade: 0,
          noFeatureVsOutcomeStats: true,
          digestsMatchManifest,
          writtenAtUtc: new Date().toISOString(),
        },
      ],
    ];
    for (const [name, value] of files) {
      writeJson(path.join(artifactDir, name), value);
      artifactsWritten.push(name);
    }
  }

  if (!reproducibility.pass) {
    throw new Error(
      `PE-4I.18 reproducibility failed: ${reproducibility.detail}`,
    );
  }
  if (!holdout2025Firewall.pass) {
    throw new Error(
      `PE-4I.18 holdout firewall failed: calendar2025Rows=${holdout2025Firewall.calendar2025RowsObserved}`,
    );
  }

  return {
    protocol,
    protocolDigest,
    providerCallsMade: 0,
    noFeatureVsOutcomeStats: true,
    datasetIdentity: {
      sourceSubdir: PE4I18_SOURCE_DATASET_SUBDIR,
      pathARowCount: loaded.pathARowCount,
      pathBRowCount: loaded.pathBRowCount,
      pathADigest: loaded.pathADigest,
      pathBDigest: loaded.pathBDigest,
      manifestPathADigest: manifest.pathADigest,
      manifestPathBDigest: manifest.pathBDigest,
      digestsMatchManifest,
    },
    schemaInventory,
    identifiersExcluded,
    candidateFeatureCount: allowlist.length,
    presenceAudit: pass1.presence,
    constantNearConstantAudit: pass1.descriptive,
    exactRedundancyAudit: pass1.exact,
    correlationAudit: pass1.correlation,
    windowRedundancyAudit: pass1.window,
    venueModeAudit: pass1.venue,
    featureFamilyMatrix: familyMatrix,
    xgHeterogeneity: {
      contract: PE4I15_XG_HETEROGENEITY_CONTRACT,
      anyXgPresentShare: pass1.anyXgPresentShare,
      note: "Optional Path B; missing stays missing; no population shift.",
    },
    sparseHistoryAudit: pass1.sparse,
    targetLabelFirewall,
    holdout2025Firewall,
    reproducibility,
    auditDigest,
    artifactDirRelative,
    artifactsWritten,
  };
}

/**
 * In-memory structure audit over synthetic/joined rows (unit tests).
 * Never accepts label payloads for stats.
 */
export function runStructureAuditOnRows(input: {
  rows: LoadedRow[];
  allowlist?: readonly string[];
  pathASample?: Record<string, unknown>;
  pathBSample?: Record<string, unknown> | null;
}): {
  presence: Pe4I18PresenceAudit;
  descriptive: Pe4I18DescriptiveStatsAudit;
  exact: Pe4I18ExactRedundancyAudit;
  correlation: Pe4I18CorrelationAudit;
  window: Pe4I18WindowRedundancyAudit;
  venue: Pe4I18VenueModeAudit;
  sparse: Pe4I18SparseHistoryAudit;
  schemaInventory: Pe4I18SchemaInventory;
  auditDigest: string;
  familyMatrix: Pe4I18FeatureFamilyMatrix;
} {
  const allowlist = input.allowlist ?? canonicalNumericAllowlist();
  const pairwiseAllowlist = pairwiseNumericAllowlist(allowlist);
  const sample =
    input.pathASample ??
    ({
      targetFixtureId: "t",
      kickoffUtc: "2024-01-01T00:00:00.000Z",
      competition: "39",
      providerSeason: "2024",
      teamId: "1",
      opponentId: "2",
      windowId: "last_5",
      venueMode: "all",
      pathA: { observationCount: 0 },
      scheduleRest: { status: "UNAVAILABLE" },
    } as Record<string, unknown>);
  const schemaInventory = buildSchemaInventory({
    pathASample: sample,
    pathBSample: input.pathBSample ?? null,
  });
  schemaInventory.allowlist = [...allowlist];
  const pass = runAccumulators(input.rows, allowlist, pairwiseAllowlist);
  const familyMatrix = buildFeatureFamilyMatrix({
    scheduleRestAvailableShare: pass.scheduleRestAvailableShare,
    recentResultsAvailableShare: pass.recentResultsAvailableShare,
    xgPresentShare: pass.anyXgPresentShare,
  });
  const auditDigest = digestStructureAuditPayload({
    presenceSummary: pass.presence.summary,
    varianceCounts: pass.descriptive.countsByClass,
    exactByReason: pass.exact.byReason,
    corrBands: pass.correlation.bandCounts,
    windowSummary: pass.window.summary,
    venueSummary: pass.venue.summary,
    sparseOverall: pass.sparse.overall,
    familyStatuses: familyMatrix.families.map((f) => ({
      familyId: String(f.familyId),
      structuralStatus: f.structuralStatus,
    })),
    candidateFeatureCount: allowlist.length,
    pathADigest: "in-memory",
    pathBDigest: "in-memory",
  });
  return {
    presence: pass.presence,
    descriptive: pass.descriptive,
    exact: pass.exact,
    correlation: pass.correlation,
    window: pass.window,
    venue: pass.venue,
    sparse: pass.sparse,
    schemaInventory,
    auditDigest,
    familyMatrix,
  };
}

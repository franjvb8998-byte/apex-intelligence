/**
 * PE-4I.13 — Stage-2H FINAL statistics acquisition CLI (max 43 new provider calls).
 *
 *   npx tsx lib/debug/calibration/run-pe4i13-stage2h-final-statistics-batch.ts \
 *     --execute-live --confirm-provider-calls --stage statistics --max-calls 43
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  digestGoalsG1Protocol,
  goalsG1Protocol,
} from "@/lib/debug/calibration/goals/g1/protocol";
import { createPe4I2LiveTransportFromEnv } from "@/lib/debug/calibration/pe4-acquisition/live-transport";
import {
  PE4I2_LIVE_CONFIRM_FLAG,
  PE4I2_LIVE_EXECUTE_FLAG,
} from "@/lib/debug/calibration/pe4-acquisition/protocol";
import { assertPe4I6Stage2ALiveAuthorized } from "@/lib/debug/calibration/pe4-acquisition/stage2-auth";
import {
  PE4I13_EXPECTED_INITIAL_CACHE_HITS,
  PE4I13_EXPECTED_INITIAL_UNCACHED,
  PE4I13_STAGE2H_HARD_MAX_CALLS,
  pe4I13ArtifactDir,
  runPe4I13Stage2HFinalStatisticsBatch,
} from "@/lib/debug/calibration/pe4-acquisition/stage2h-batch";
import {
  PE4I5_FROZEN_STAGE2_QUEUE_DIGEST,
  listStatisticsCaches,
  loadFrozenStage2Queue,
  selectStatisticsBatch,
} from "@/lib/debug/calibration/pe4-acquisition/stage2-queue";
import { PE4I5_STAGE_FLAG } from "@/lib/debug/calibration/pe4-acquisition/stage1-auth";
import { PE3C_C0_RECON_ACTIVATION } from "@/lib/prematch-lifecycle/pe3-activation";
import { resolvePe4HistoricalExpectation } from "@/lib/prematch-decision/pe4-form-schedule/expectation-contract";

function loadDotEnvFiles(): void {
  for (const name of [".env.local", ".env"]) {
    const p = path.join(process.cwd(), name);
    if (!existsSync(p)) continue;
    const text = readFileSync(p, "utf8");
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (process.env[key] == null || process.env[key] === "") {
        process.env[key] = value;
      }
    }
  }
}

function apiKeyPresent(): boolean {
  const k =
    process.env.API_FOOTBALL_KEY?.trim() ||
    process.env.APISPORTS_KEY?.trim() ||
    "";
  return k.length > 0;
}

async function main(): Promise<void> {
  loadDotEnvFiles();
  const { maxCalls, stage } = assertPe4I6Stage2ALiveAuthorized(process.argv);
  if (maxCalls > PE4I13_STAGE2H_HARD_MAX_CALLS) {
    throw new Error(
      `STOP: Stage-2H refuses maxCalls=${maxCalls}; hard ceiling is ${PE4I13_STAGE2H_HARD_MAX_CALLS}`,
    );
  }

  const queue = loadFrozenStage2Queue();
  const caches = listStatisticsCaches();
  const preview = selectStatisticsBatch({
    fixtureIds: queue.fixtureIds,
    queueDigest: queue.queueDigest,
    caches,
    maxNew: maxCalls,
  });

  const expectation = resolvePe4HistoricalExpectation({
    targetStrengthCommon: 1600,
    opponentStrengthCommon: 1500,
    targetVenueRole: "HOME",
    pairwiseAvailable: true,
    historicalCutoffUtc: "2024-01-01T00:00:00.000Z",
    targetSource: "catalogue",
    opponentSource: "catalogue",
  });

  const preflight = {
    phase: "PE4I13_STAGE2H_PREFLIGHT",
    queueDigest: queue.queueDigest,
    frozenDigest: PE4I5_FROZEN_STAGE2_QUEUE_DIGEST,
    queueSize: queue.fixtureIds.length,
    initialStatisticsCacheHits: preview.initialCachedCount,
    initialUncachedFixtures: preview.initialUncachedCount,
    selectedBatchSize: preview.selectedBatchSize,
    firstSelected: preview.firstSelectedFixtureId,
    lastSelected: preview.lastSelectedFixtureId,
    batchSelectionDigest: preview.batchSelectionDigest,
    PE3C_C0_RECON_ACTIVATION,
    expectationStatus: expectation.status,
    g1SelectedShrinkageK: goalsG1Protocol(10).selectedShrinkageK,
    g1ProtocolDigest: digestGoalsG1Protocol(goalsG1Protocol(10)),
    apiKeyPresent: apiKeyPresent(),
    liveFlags: [
      PE4I2_LIVE_EXECUTE_FLAG,
      PE4I2_LIVE_CONFIRM_FLAG,
      `${PE4I5_STAGE_FLAG} ${stage}`,
      `--max-calls ${maxCalls}`,
    ],
    scheduleCallsAllowed: false,
    modelingAllowed: false,
  };
  console.log(JSON.stringify(preflight, null, 2));

  if (queue.queueDigest !== PE4I5_FROZEN_STAGE2_QUEUE_DIGEST) {
    throw new Error("STOP: queue digest differs from PE-4I.5 frozen");
  }
  if (preview.initialCachedCount !== PE4I13_EXPECTED_INITIAL_CACHE_HITS) {
    throw new Error(
      `STOP: expected exactly ${PE4I13_EXPECTED_INITIAL_CACHE_HITS} cache hits before Stage-2H; got ${preview.initialCachedCount}`,
    );
  }
  if (preview.initialUncachedCount !== PE4I13_EXPECTED_INITIAL_UNCACHED) {
    throw new Error(
      `STOP: expected exactly ${PE4I13_EXPECTED_INITIAL_UNCACHED} uncached before Stage-2H; got ${preview.initialUncachedCount}`,
    );
  }
  if (
    preview.initialUncachedCount <= PE4I13_STAGE2H_HARD_MAX_CALLS &&
    preview.selectedBatchSize !== preview.initialUncachedCount
  ) {
    throw new Error(
      `STOP: selectedBatchSize ${preview.selectedBatchSize} must equal initialUncachedCount ${preview.initialUncachedCount}`,
    );
  }
  if (PE3C_C0_RECON_ACTIVATION !== false) {
    throw new Error("STOP: PE3C_C0_RECON_ACTIVATION must be false");
  }
  if (expectation.status !== "UNAVAILABLE") {
    throw new Error("STOP: production expectation must be UNAVAILABLE");
  }
  if (goalsG1Protocol(10).selectedShrinkageK !== 10) {
    throw new Error("STOP: G1 k must remain 10");
  }
  if (!apiKeyPresent()) {
    throw new Error("STOP: API key missing");
  }

  const transport = createPe4I2LiveTransportFromEnv(process.env);
  const report = await runPe4I13Stage2HFinalStatisticsBatch({
    transport,
    maxCalls,
  });

  const reportPath = path.join(pe4I13ArtifactDir(), "stage2h-report.json");
  writeFileSync(reportPath, JSON.stringify(report, null, 2) + "\n", "utf8");
  console.log(JSON.stringify(report, null, 2));
  console.log(
    JSON.stringify(
      {
        stage2hReportPath: path
          .relative(process.cwd(), reportPath)
          .replace(/\\/g, "/"),
        artifactDir: path
          .relative(process.cwd(), pe4I13ArtifactDir())
          .replace(/\\/g, "/"),
      },
      null,
      2,
    ),
  );

  if (report.scheduleEndpointAttempts > 0) {
    process.exitCode = 1;
    throw new Error("STOP: schedule endpoint was attempted");
  }
  if (report.firstPass.providerCallsAttempted > maxCalls) {
    process.exitCode = 1;
    throw new Error("STOP: provider calls exceeded maxCalls");
  }
}

const invoked =
  process.argv[1]
    ?.replace(/\\/g, "/")
    .endsWith("run-pe4i13-stage2h-final-statistics-batch.ts") === true;

if (invoked) {
  main().catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
  });
}

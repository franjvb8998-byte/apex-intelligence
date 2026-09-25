/**
 * PE-4I.5 — Stage-1 bounded schedule discovery CLI.
 *
 *   npx tsx lib/debug/calibration/run-pe4i5-stage1-schedule-discovery.ts \
 *     --execute-live --confirm-provider-calls --stage schedule --max-calls 50
 *
 * Importing this file does not fetch.
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createPe4I2LiveTransportFromEnv } from "@/lib/debug/calibration/pe4-acquisition/live-transport";
import {
  PE4I2_LIVE_CONFIRM_FLAG,
  PE4I2_LIVE_EXECUTE_FLAG,
} from "@/lib/debug/calibration/pe4-acquisition/protocol";
import {
  PE4I5_STAGE_FLAG,
  assertPe4I5Stage1LiveAuthorized,
} from "@/lib/debug/calibration/pe4-acquisition/stage1-auth";
import {
  pe4I5ArtifactDir,
  runPe4I5Stage1ScheduleDiscovery,
} from "@/lib/debug/calibration/pe4-acquisition/stage1-discovery";
import { buildPe4I4BulkAcquisitionPlan } from "@/lib/debug/calibration/pe4-acquisition/bulk-plan";
import { PE3C_C0_RECON_ACTIVATION } from "@/lib/prematch-lifecycle/pe3-activation";
import { resolvePe4HistoricalExpectation } from "@/lib/prematch-decision/pe4-form-schedule/expectation-contract";
import {
  digestGoalsG1Protocol,
  goalsG1Protocol,
} from "@/lib/debug/calibration/goals/g1/protocol";

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
  const { maxCalls, stage } = assertPe4I5Stage1LiveAuthorized(process.argv);

  const plan = buildPe4I4BulkAcquisitionPlan();
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
    phase: "PE4I5_STAGE1_PREFLIGHT",
    branchHint: "see git",
    pe4i3Cache: plan.pe4i3Cache,
    clubSeasonUnits: plan.clubSeasonUnits.length,
    cachedScheduleUnits: plan.cachedScheduleUnits,
    missingScheduleUnits: plan.missingScheduleUnits,
    PE3C_C0_RECON_ACTIVATION,
    expectationStatus: expectation.status,
    g1SelectedShrinkageK: goalsG1Protocol(10).selectedShrinkageK,
    g1ProtocolDigest: digestGoalsG1Protocol(goalsG1Protocol(10)),
    holdoutSeason: plan.holdoutSeason,
    apiKeyPresent: apiKeyPresent(),
    liveFlags: [
      PE4I2_LIVE_EXECUTE_FLAG,
      PE4I2_LIVE_CONFIRM_FLAG,
      `${PE4I5_STAGE_FLAG} ${stage}`,
      `--max-calls ${maxCalls}`,
    ],
    statisticsCallsAllowed: false,
  };
  console.log(JSON.stringify(preflight, null, 2));

  if (!plan.pe4i3Cache.loadOk) {
    throw new Error(`PE-4I.3 cache invalid: ${plan.pe4i3Cache.message}`);
  }
  if (plan.clubSeasonUnits.length !== 40) {
    throw new Error(`expected 40 club-season units, got ${plan.clubSeasonUnits.length}`);
  }
  if (plan.cachedScheduleUnits !== 1 || plan.missingScheduleUnits !== 39) {
    // Allow fewer missing if more cache already present (resume).
    if (plan.missingScheduleUnits > 50) {
      throw new Error(
        `missing schedule units ${plan.missingScheduleUnits} exceed Stage-1 max`,
      );
    }
    console.log(
      JSON.stringify({
        note: "cache state differs from pristine 1/39 — resume-safe path",
        cachedScheduleUnits: plan.cachedScheduleUnits,
        missingScheduleUnits: plan.missingScheduleUnits,
      }),
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
  const report = await runPe4I5Stage1ScheduleDiscovery({
    transport,
    maxCalls,
  });

  const reportPath = path.join(pe4I5ArtifactDir(), "stage1-report.json");
  writeFileSync(reportPath, JSON.stringify(report, null, 2) + "\n", "utf8");
  console.log(JSON.stringify(report, null, 2));
  console.log(
    JSON.stringify(
      {
        stage1ReportPath: path
          .relative(process.cwd(), reportPath)
          .replace(/\\/g, "/"),
        artifactDir: path
          .relative(process.cwd(), pe4I5ArtifactDir())
          .replace(/\\/g, "/"),
      },
      null,
      2,
    ),
  );

  if (report.secondPass.wouldCallProvider) {
    process.exitCode = 1;
    throw new Error(
      "STOP: second-pass cache resume proof failed (would call provider)",
    );
  }
  if (report.statisticsEndpointAttempts > 0) {
    process.exitCode = 1;
    throw new Error("STOP: statistics endpoint was attempted");
  }
  if (report.firstPass.providerCallsAttempted > maxCalls) {
    process.exitCode = 1;
    throw new Error("STOP: provider calls exceeded maxCalls");
  }
}

const invoked =
  process.argv[1]
    ?.replace(/\\/g, "/")
    .endsWith("run-pe4i5-stage1-schedule-discovery.ts") === true;

if (invoked) {
  main().catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
  });
}

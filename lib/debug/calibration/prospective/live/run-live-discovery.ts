/**
 * Authorized 5C.4 live discovery entry.
 * Importing this file does not fetch. Tests must not import it.
 *
 * Command (after offline tests and human authorization only):
 *   APEX_CALIBRATION_LIVE=1 npx --yes tsx lib/debug/calibration/prospective/live/run-live-discovery.ts --execute
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { assertLiveCollectionAuthorized } from "@/lib/debug/calibration/live-guard";
import { createInjectedClock } from "@/lib/debug/calibration/prospective/capture/capture-clock";
import { discoverLiveFixtures } from "@/lib/debug/calibration/prospective/live/discovery-runner";
import { createLiveDiscoveryTransport } from "@/lib/debug/calibration/prospective/live/discovery-transport";
import { DISCOVERY_ALLOWED_PATH, DISCOVERY_FIXTURE_QUERY } from "@/lib/debug/calibration/prospective/live/discovery-types";

function loadDotEnvFiles(): void {
  for (const name of [".env.local", ".env"]) {
    const path = join(process.cwd(), name);
    if (!existsSync(path)) continue;
    const text = readFileSync(path, "utf8");
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith("\"") && value.endsWith("\"")) ||
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

function report(result: Awaited<ReturnType<typeof discoverLiveFixtures>>): void {
  const lines = [
    "RC2 5C.4 LIVE DISCOVERY REPORT",
    `phase=${result.phase}`,
    `provider=${result.provider}`,
    `discoveredAtUtc=${result.discoveredAtUtc}`,
    `verifiedSeason=${result.verifiedSeason ?? "UNVERIFIED"}`,
    `seasonVerificationMethod=${result.seasonVerificationMethod}`,
    `endpoint=${DISCOVERY_ALLOWED_PATH}`,
    `parameters=league=${DISCOVERY_FIXTURE_QUERY.league}&next=${DISCOVERY_FIXTURE_QUERY.next}`,
    `liveCallCount=${result.liveCallCount}`,
    `fixtureDiscoveryCalls=${result.callAccounting.fixtureDiscoveryCalls}`,
    `seasonDiscoveryCalls=${result.callAccounting.seasonDiscoveryCalls}`,
    `oddsCalls=${result.callAccounting.oddsCalls}`,
    `evidenceCalls=${result.callAccounting.evidenceCalls}`,
    `totalCalls=${result.callAccounting.totalCalls}`,
    `fixtureCountReturned=${result.fixtureCountReturned}`,
    `upcomingFixtureCount=${result.upcomingFixtureCount}`,
    `observedStatuses=${result.observedStatuses.join(",") || "(none)"}`,
    `predictionsCaptured=${result.predictionsCaptured}`,
    `createdPredictions=${result.createdPredictions}`,
    `rawResponsePersisted=${result.rawResponsePersisted}`,
    `scoresPersisted=${result.scoresPersisted}`,
    `artifactPath=${result.artifactPath ?? "(not written)"}`,
    `liveCaptureOpportunityDetected=${result.liveCaptureOpportunityDetected}`,
  ];
  if (result.liveCaptureOpportunityDetected) {
    lines.push("LIVE CAPTURE OPPORTUNITY DETECTED");
    for (const row of result.captureOpportunities) {
      lines.push(
        `IN_WINDOW fixtureId=${row.fixtureId} teams=${row.homeTeamName} vs ${row.awayTeamName} kickoffUtc=${row.kickoffUtc} minutesUntilKickoff=${row.minutesUntilKickoff} status=${row.statusShort}/${row.statusLong}`,
      );
    }
  }
  lines.push("nearestUpcoming:");
  for (const row of result.nearestUpcoming) {
    lines.push(
      `  ${row.kickoffUtc} ${row.homeTeamName} vs ${row.awayTeamName} fixtureId=${row.fixtureId} T-${row.minutesUntilKickoff} ${row.classification} status=${row.statusShort}`,
    );
  }
  process.stdout.write(`${lines.join("\n")}\n`);
}

async function main(): Promise<void> {
  loadDotEnvFiles();
  assertLiveCollectionAuthorized(process.env, process.argv);
  const result = await discoverLiveFixtures({
    transport: createLiveDiscoveryTransport(process.env),
    clock: createInjectedClock(() => new Date().toISOString()),
    persist: true,
  });
  report(result);
}

const invoked =
  process.argv[1]?.replace(/\\/g, "/").endsWith("run-live-discovery.ts") === true;

if (invoked) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exitCode = 1;
  });
}

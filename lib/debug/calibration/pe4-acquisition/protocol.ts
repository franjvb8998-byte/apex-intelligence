/**
 * PE-4I.2 — Frozen offline acquisition protocol.
 * Research-only. Default mode is dry-run / plan. No live provider calls.
 */

import { createHash } from "node:crypto";

export const PE4I2_PROTOCOL_VERSION =
  "pe4.offline_multi_comp_stats_acquisition.v1" as const;

export const PE4I2_ACQUISITION_VERSION =
  "pe4.acquisition.infrastructure.v1" as const;

export const PE4I2_SCHEMA_VERSION = "pe4.acquisition.raw.v1" as const;

export const PE4I2_PROVIDER = "api-football" as const;

/** Premier League — evidenced throughout APEX calibration / Match Center. */
export const PE4I2_TARGET_LEAGUE_PROVIDER_ID = "39" as const;

export const PE4I2_ALLOWED_SEASONS = ["2023", "2024"] as const;
export type Pe4I2AllowedSeason = (typeof PE4I2_ALLOWED_SEASONS)[number];

export const PE4I2_HOLDOUT_SEASON = "2025" as const;

export const PE4I2_HOLDOUT_POLICY =
  "REJECT_2025_OUTCOME_AND_METADATA_IN_THIS_PROTOCOL" as const;

/**
 * PL clubs observed in GOALS-1B evidence (competitionId=39).
 * Not invented — derived from offline dataset digest e06c44a6…5b95.
 */
export const PE4I2_PL_TEAMS_2023 = [
  "33",
  "34",
  "35",
  "36",
  "39",
  "40",
  "42",
  "44",
  "45",
  "47",
  "48",
  "49",
  "50",
  "51",
  "52",
  "55",
  "62",
  "65",
  "66",
  "1359",
] as const;

export const PE4I2_PL_TEAMS_2024 = [
  "33",
  "34",
  "35",
  "36",
  "39",
  "40",
  "41",
  "42",
  "45",
  "46",
  "47",
  "48",
  "49",
  "50",
  "51",
  "52",
  "55",
  "57",
  "65",
  "66",
] as const;

export const PE4I2_ROSTER_PROVENANCE =
  "goals.historical.evidence.v1 competitionId=39 seasons 2023/2024 unique home/away team ids" as const;

export const PE4I2_CACHE_ROOT_RELATIVE =
  "data/calibration/pe4-acquisition-v1" as const;

export const PE4I2_XG_STATUS =
  "UNKNOWN_UNTIL_CONTROLLED_PROVIDER_SAMPLE" as const;

export const PE4I2_DEFAULT_MODE = "dry_run" as const;

export const PE4I2_LIVE_EXECUTE_FLAG = "--execute-live" as const;
export const PE4I2_LIVE_CONFIRM_FLAG = "--confirm-provider-calls" as const;

export type Pe4I2Protocol = {
  protocolVersion: typeof PE4I2_PROTOCOL_VERSION;
  acquisitionVersion: typeof PE4I2_ACQUISITION_VERSION;
  schemaVersion: typeof PE4I2_SCHEMA_VERSION;
  provider: typeof PE4I2_PROVIDER;
  targetLeagueProviderId: typeof PE4I2_TARGET_LEAGUE_PROVIDER_ID;
  allowedSeasons: readonly Pe4I2AllowedSeason[];
  holdoutSeason: typeof PE4I2_HOLDOUT_SEASON;
  holdoutPolicy: typeof PE4I2_HOLDOUT_POLICY;
  rosterProvenance: typeof PE4I2_ROSTER_PROVENANCE;
  cacheRootRelative: typeof PE4I2_CACHE_ROOT_RELATIVE;
  xgStatus: typeof PE4I2_XG_STATUS;
  defaultMode: typeof PE4I2_DEFAULT_MODE;
  liveRequiresFlags: readonly [
    typeof PE4I2_LIVE_EXECUTE_FLAG,
    typeof PE4I2_LIVE_CONFIRM_FLAG,
  ];
  noUnlimitedBudget: true;
  productionWiringForbidden: true;
  g1Unchanged: true;
  pe3ActivationMustRemainFalse: true;
};

export function pe4I2Protocol(): Pe4I2Protocol {
  return {
    protocolVersion: PE4I2_PROTOCOL_VERSION,
    acquisitionVersion: PE4I2_ACQUISITION_VERSION,
    schemaVersion: PE4I2_SCHEMA_VERSION,
    provider: PE4I2_PROVIDER,
    targetLeagueProviderId: PE4I2_TARGET_LEAGUE_PROVIDER_ID,
    allowedSeasons: PE4I2_ALLOWED_SEASONS,
    holdoutSeason: PE4I2_HOLDOUT_SEASON,
    holdoutPolicy: PE4I2_HOLDOUT_POLICY,
    rosterProvenance: PE4I2_ROSTER_PROVENANCE,
    cacheRootRelative: PE4I2_CACHE_ROOT_RELATIVE,
    xgStatus: PE4I2_XG_STATUS,
    defaultMode: PE4I2_DEFAULT_MODE,
    liveRequiresFlags: [PE4I2_LIVE_EXECUTE_FLAG, PE4I2_LIVE_CONFIRM_FLAG],
    noUnlimitedBudget: true,
    productionWiringForbidden: true,
    g1Unchanged: true,
    pe3ActivationMustRemainFalse: true,
  };
}

export function digestPe4I2Protocol(protocol: Pe4I2Protocol = pe4I2Protocol()): string {
  return createHash("sha256")
    .update(JSON.stringify(protocol, Object.keys(protocol).sort(), 2), "utf8")
    .digest("hex");
}

export function assertSeasonAllowed(season: string): Pe4I2AllowedSeason {
  if (season === PE4I2_HOLDOUT_SEASON) {
    throw new Error(
      `PE-4I.2 holdout firewall: season ${PE4I2_HOLDOUT_SEASON} is rejected`,
    );
  }
  if (season === "2023" || season === "2024") return season;
  throw new Error(`PE-4I.2 season not allowed: ${season}`);
}

export function teamsForSeason(season: Pe4I2AllowedSeason): readonly string[] {
  return season === "2023" ? PE4I2_PL_TEAMS_2023 : PE4I2_PL_TEAMS_2024;
}

/**
 * PE-4I.17 — Offline DEV feature dataset emission + coverage audit.
 * Research/calibration only. No fitting, weights, odds/EV, or production wiring.
 */

import { createHash } from "node:crypto";
import {
  PE4I15_PARENT_QUEUE_DIGEST,
  PE4I15_PRODUCTION_WIRING,
} from "@/lib/debug/calibration/pe4-as-of-t-features/protocol";
import { PE4I16_PRODUCTION_WIRING } from "@/lib/debug/calibration/pe4-as-of-t-features/pe4i16-protocol";
import type { Pe4I15WindowSpec } from "@/lib/debug/calibration/pe4-as-of-t-features/window-contract";
import { PE4I15_WINDOW_CONTRACT } from "@/lib/debug/calibration/pe4-as-of-t-features/window-contract";
import type { Pe4I16VenueFilter } from "@/lib/debug/calibration/pe4-as-of-t-features/history-selector";

export const PE4I17_PROTOCOL_VERSION =
  "pe4.offline_dev_feature_dataset.v1" as const;

export const PE4I17_SCHEMA_VERSION =
  "pe4.offline_dev_feature_dataset.schema.v1" as const;

export const PE4I17_SCOPE = "research_calibration_offline_only" as const;

export const PE4I17_PRODUCTION_WIRING = false as const;

export const PE4I17_ARTIFACT_SUBDIR = "stage2i17-dev-dataset" as const;

export const PE4I17_PARENT_QUEUE_DIGEST = PE4I15_PARENT_QUEUE_DIGEST;

/**
 * Emit window IDs (PE-4I.17). Calendar windows use trailing_* aliases;
 * underlying selection uses PE-4I.15 days_* specs.
 */
export const PE4I17_EMIT_WINDOW_IDS = [
  "last_3",
  "last_5",
  "last_8",
  "last_10",
  "trailing_30d",
  "trailing_60d",
  "trailing_90d",
] as const;

export type Pe4I17EmitWindowId = (typeof PE4I17_EMIT_WINDOW_IDS)[number];

/** Venue modes emitted as separate dataset rows (PE-4I.16 venue filters). */
export const PE4I17_VENUE_MODES = ["all", "home", "away"] as const;

export type Pe4I17VenueMode = (typeof PE4I17_VENUE_MODES)[number];

export type Pe4I17Protocol = {
  protocolVersion: typeof PE4I17_PROTOCOL_VERSION;
  schemaVersion: typeof PE4I17_SCHEMA_VERSION;
  parentQueueDigest: typeof PE4I17_PARENT_QUEUE_DIGEST;
  scope: typeof PE4I17_SCOPE;
  productionWiring: typeof PE4I17_PRODUCTION_WIRING;
  pe4i15ProductionWiring: typeof PE4I15_PRODUCTION_WIRING;
  pe4i16ProductionWiring: typeof PE4I16_PRODUCTION_WIRING;
  modelingForbidden: true;
  noWeights: true;
  noOddsEv: true;
  no2025Unsealing: true;
  providerCallsForbidden: true;
  outcomeLabelsSeparated: true;
  emitWindowIds: typeof PE4I17_EMIT_WINDOW_IDS;
  venueModes: typeof PE4I17_VENUE_MODES;
};

export function pe4I17Protocol(): Pe4I17Protocol {
  return {
    protocolVersion: PE4I17_PROTOCOL_VERSION,
    schemaVersion: PE4I17_SCHEMA_VERSION,
    parentQueueDigest: PE4I17_PARENT_QUEUE_DIGEST,
    scope: PE4I17_SCOPE,
    productionWiring: PE4I17_PRODUCTION_WIRING,
    pe4i15ProductionWiring: PE4I15_PRODUCTION_WIRING,
    pe4i16ProductionWiring: PE4I16_PRODUCTION_WIRING,
    modelingForbidden: true,
    noWeights: true,
    noOddsEv: true,
    no2025Unsealing: true,
    providerCallsForbidden: true,
    outcomeLabelsSeparated: true,
    emitWindowIds: PE4I17_EMIT_WINDOW_IDS,
    venueModes: PE4I17_VENUE_MODES,
  };
}

export function digestPe4I17Protocol(
  protocol: Pe4I17Protocol = pe4I17Protocol(),
): string {
  return createHash("sha256")
    .update(JSON.stringify(protocol), "utf8")
    .digest("hex");
}

function findWindowSpec(pred: (w: Pe4I15WindowSpec) => boolean): Pe4I15WindowSpec {
  const found = PE4I15_WINDOW_CONTRACT.find(pred);
  if (!found) {
    throw new Error("PE4I15_WINDOW_CONTRACT missing expected window");
  }
  return found;
}

/** Map PE-4I.17 emit window id → PE-4I.15 window spec. */
export function pe4I17WindowSpec(windowId: Pe4I17EmitWindowId): Pe4I15WindowSpec {
  switch (windowId) {
    case "last_3":
      return findWindowSpec((w) => w.kind === "last_n" && w.n === 3);
    case "last_5":
      return findWindowSpec((w) => w.kind === "last_n" && w.n === 5);
    case "last_8":
      return findWindowSpec((w) => w.kind === "last_n" && w.n === 8);
    case "last_10":
      return findWindowSpec((w) => w.kind === "last_n" && w.n === 10);
    case "trailing_30d":
      return findWindowSpec((w) => w.kind === "calendar_days" && w.days === 30);
    case "trailing_60d":
      return findWindowSpec((w) => w.kind === "calendar_days" && w.days === 60);
    case "trailing_90d":
      return findWindowSpec((w) => w.kind === "calendar_days" && w.days === 90);
    default: {
      const _exhaustive: never = windowId;
      throw new Error(`unknown emit window: ${_exhaustive}`);
    }
  }
}

export function pe4I17VenueFilter(mode: Pe4I17VenueMode): Pe4I16VenueFilter {
  return mode;
}

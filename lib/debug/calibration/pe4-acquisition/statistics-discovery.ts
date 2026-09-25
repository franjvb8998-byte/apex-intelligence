/**
 * PE-4I.2 — Raw statistics field discovery + candidate canonical maps.
 * Does not prove provider xG availability.
 */

import { PE4I2_XG_STATUS } from "@/lib/debug/calibration/pe4-acquisition/protocol";
import type { Pe4I2RawStatisticRow } from "@/lib/debug/calibration/pe4-acquisition/envelopes";

export type Pe4I2CanonicalStatKey =
  | "shots"
  | "shots_on_target"
  | "possession"
  | "corners"
  | "yellow_cards"
  | "red_cards"
  | "vendor_expected_goals";

/** Candidate mappings from names already recognized in Match Analysis parsers. */
export const PE4I2_CANDIDATE_STAT_NAME_MAP: Readonly<
  Record<Pe4I2CanonicalStatKey, readonly string[]>
> = {
  shots: ["total shots", "shots"],
  shots_on_target: ["shots on goal", "shots on target"],
  possession: ["ball possession", "possession"],
  corners: ["corner kicks", "corners"],
  yellow_cards: ["yellow cards"],
  red_cards: ["red cards"],
  vendor_expected_goals: ["expected_goals", "expected goals", "xg"],
};

export type Pe4I2StatInventoryRow = {
  rawName: string;
  observedValueTypes: string[];
  fixtureCountContaining: number;
  teamSideCount: number;
  missingCount: number;
  parseableNumericCount: number;
  candidateCanonical: Pe4I2CanonicalStatKey | null;
};

export type Pe4I2StatisticsDiscoveryReport = {
  xgStatus: typeof PE4I2_XG_STATUS;
  vendorXgFieldEverObserved: boolean;
  inventory: Pe4I2StatInventoryRow[];
};

function valueTypeOf(v: string | number | null): string {
  if (v === null) return "null";
  return typeof v;
}

function candidateForName(rawName: string): Pe4I2CanonicalStatKey | null {
  const lower = rawName.toLowerCase();
  for (const [key, names] of Object.entries(PE4I2_CANDIDATE_STAT_NAME_MAP) as [
    Pe4I2CanonicalStatKey,
    readonly string[],
  ][]) {
    if (names.some((n) => n.toLowerCase() === lower)) return key;
  }
  return null;
}

export function buildRawStatisticRow(
  rawName: string,
  rawValue: string | number | null | undefined,
): Pe4I2RawStatisticRow {
  const presence =
    rawValue === undefined || rawValue === null ? "missing" : "present";
  const value: string | number | null =
    presence === "missing" ? null : (rawValue as string | number);
  let parsedNumeric: number | null = null;
  let parseableNumeric = false;
  if (presence === "present") {
    if (typeof value === "number" && Number.isFinite(value)) {
      parsedNumeric = value;
      parseableNumeric = true;
    } else if (typeof value === "string") {
      const parsed = Number.parseFloat(value.replace("%", "").trim());
      if (Number.isFinite(parsed)) {
        parsedNumeric = parsed;
        parseableNumeric = true;
      }
    }
  }
  return {
    rawName,
    rawValue: value,
    valuePresence: presence,
    parseableNumeric,
    parsedNumeric,
  };
}

/**
 * Missing ≠ zero. A present numeric 0 is kept as 0 with presence=present.
 */
export function inventoryStatisticsFields(
  observations: readonly {
    providerFixtureId: string;
    teamBlocks: readonly { statistics: readonly Pe4I2RawStatisticRow[] }[];
  }[],
): Pe4I2StatisticsDiscoveryReport {
  type Acc = {
    types: Set<string>;
    fixtureIds: Set<string>;
    teamSideCount: number;
    missingCount: number;
    parseableNumericCount: number;
  };
  const byName = new Map<string, Acc>();
  let vendorXgFieldEverObserved = false;

  for (const obs of observations) {
    for (const block of obs.teamBlocks) {
      for (const row of block.statistics) {
        let acc = byName.get(row.rawName);
        if (!acc) {
          acc = {
            types: new Set(),
            fixtureIds: new Set(),
            teamSideCount: 0,
            missingCount: 0,
            parseableNumericCount: 0,
          };
          byName.set(row.rawName, acc);
        }
        acc.types.add(valueTypeOf(row.rawValue));
        acc.fixtureIds.add(obs.providerFixtureId);
        acc.teamSideCount += 1;
        if (row.valuePresence === "missing") acc.missingCount += 1;
        if (row.parseableNumeric) acc.parseableNumericCount += 1;
        const canon = candidateForName(row.rawName);
        if (
          canon === "vendor_expected_goals" &&
          row.valuePresence === "present"
        ) {
          vendorXgFieldEverObserved = true;
        }
      }
    }
  }

  const inventory: Pe4I2StatInventoryRow[] = [...byName.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([rawName, acc]) => ({
      rawName,
      observedValueTypes: [...acc.types].sort(),
      fixtureCountContaining: acc.fixtureIds.size,
      teamSideCount: acc.teamSideCount,
      missingCount: acc.missingCount,
      parseableNumericCount: acc.parseableNumericCount,
      candidateCanonical: candidateForName(rawName),
    }));

  return {
    xgStatus: PE4I2_XG_STATUS,
    vendorXgFieldEverObserved,
    inventory,
  };
}

export function resolveXgStatus(vendorXgFieldEverObserved: boolean): {
  status: typeof PE4I2_XG_STATUS | "VENDOR_XG_FIELD_OBSERVED_IN_SAMPLE";
  note: string;
} {
  if (!vendorXgFieldEverObserved) {
    return {
      status: PE4I2_XG_STATUS,
      note: "No provider expected_goals/xg field observed in acquisition samples. EloPoisson expectedGoals is not vendor xG.",
    };
  }
  return {
    status: "VENDOR_XG_FIELD_OBSERVED_IN_SAMPLE",
    note: "Provider emitted an expected_goals/xg-like field in at least one sample. Coverage still requires controlled audit.",
  };
}

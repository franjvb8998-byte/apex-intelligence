/**
 * PE-5.4C increment 1 — offline authorization tests.
 * No provider calls, no environment reads, no sealed 2025 outcome reads.
 */

import { readFileSync } from "node:fs";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

const realFlagControls = vi.hoisted(() => ({
  useOverlay: false,
  productionWiring: false as unknown,
  acquisitionAuthorized: false as unknown,
  collectorAuthorized: false as unknown,
  pe53Authorized: false as unknown,
  liveProviderAuthorized: false as unknown,
}));

vi.mock("@/lib/debug/calibration/pe5-availability/protocol", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/debug/calibration/pe5-availability/protocol")
  >("@/lib/debug/calibration/pe5-availability/protocol");
  return {
    ...actual,
    pe5Protocol() {
      const protocol = actual.pe5Protocol();
      if (!realFlagControls.useOverlay) return protocol;
      return {
        ...protocol,
        productionWiring: realFlagControls.productionWiring,
        acquisitionAuthorized: realFlagControls.acquisitionAuthorized,
        collectorAuthorized: realFlagControls.collectorAuthorized,
        pe53Authorized: realFlagControls.pe53Authorized,
      };
    },
  };
});

vi.mock("@/lib/debug/calibration/pe5-availability/probe-fixtures", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/debug/calibration/pe5-availability/probe-fixtures")
  >("@/lib/debug/calibration/pe5-availability/probe-fixtures");
  return {
    ...actual,
    get PE53B_LIVE_PROVIDER_AUTHORIZED() {
      return realFlagControls.useOverlay
        ? realFlagControls.liveProviderAuthorized
        : actual.PE53B_LIVE_PROVIDER_AUTHORIZED;
    },
  };
});

import {
  evaluateAuthorization,
  readRealProtocolFlags,
} from "@/lib/debug/calibration/pe5-acquisition-boundary/authorize";
import {
  PROTOCOL_FLAG_KEYS,
  type AuthorizationEnv,
  type ProtocolFlagSnapshot,
} from "@/lib/debug/calibration/pe5-acquisition-boundary/types";
import { PE53B_LIVE_PROVIDER_AUTHORIZED } from "@/lib/debug/calibration/pe5-availability/probe-fixtures";
import {
  PE5_PRODUCTION_WIRING,
  pe5Protocol,
} from "@/lib/debug/calibration/pe5-availability/protocol";

const NOW = 1_700_000_000_000;
const MAX_AGE_MS = 60_000;

afterEach(() => {
  realFlagControls.useOverlay = false;
  realFlagControls.productionWiring = false;
  realFlagControls.acquisitionAuthorized = false;
  realFlagControls.collectorAuthorized = false;
  realFlagControls.pe53Authorized = false;
  realFlagControls.liveProviderAuthorized = false;
});

function overlayRealFlags(overrides: {
  productionWiring?: unknown;
  acquisitionAuthorized?: unknown;
  collectorAuthorized?: unknown;
  pe53Authorized?: unknown;
  liveProviderAuthorized?: unknown;
}) {
  realFlagControls.useOverlay = true;
  realFlagControls.productionWiring = false;
  realFlagControls.acquisitionAuthorized = false;
  realFlagControls.collectorAuthorized = false;
  realFlagControls.pe53Authorized = false;
  realFlagControls.liveProviderAuthorized = false;
  Object.assign(realFlagControls, overrides);
}

function openFlags(
  overrides: Partial<ProtocolFlagSnapshot> = {},
): ProtocolFlagSnapshot {
  return {
    PE5_PRODUCTION_WIRING: false,
    acquisitionAuthorized: false,
    collectorAuthorized: false,
    pe53Authorized: false,
    PE53B_LIVE_PROVIDER_AUTHORIZED: false,
    ...overrides,
  };
}

function offlineEnv(
  overrides: Partial<AuthorizationEnv> = {},
): AuthorizationEnv {
  return {
    APEX_PE5_ACQUISITION_MODE: "offline",
    ledgerInstanceId: "ledger-a",
    ...overrides,
  };
}

function approval(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    mode: "offline",
    credentialId: "cred-research",
    ledgerInstanceId: "ledger-a",
    operator: "research-operator",
    researchCeiling: 5,
    dailyCeiling: 5,
    rateCeiling: 5,
    rateWindowMs: 10_000,
    leaseMs: 5_000,
    fetchTimeoutMs: 1_000,
    maxAgeMs: MAX_AGE_MS,
    expiry: NOW + 86_400_000,
    ...overrides,
  };
}

function clearKill(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    state: "clear",
    version: 3,
    updatedAt: NOW,
    maxAgeMs: MAX_AGE_MS,
    ...overrides,
  };
}

function decide(input: {
  env?: unknown;
  approval?: unknown;
  kill?: unknown;
  protocolFlags?: unknown;
  now?: unknown;
} = {}) {
  return evaluateAuthorization(
    "env" in input ? input.env : offlineEnv(),
    "approval" in input ? input.approval : approval(),
    "kill" in input ? input.kill : clearKill(),
    "protocolFlags" in input ? input.protocolFlags : openFlags(),
    "now" in input ? input.now : NOW,
  );
}

describe("PE-5.4C increment 1 authorization", () => {
  it("allows offline when every required input is present and fresh", () => {
    expect(decide()).toEqual({ decision: "allow-offline" });
  });

  it("mode-missing denies when the mode is unset", () => {
    expect(decide({ env: { ledgerInstanceId: "ledger-a" } })).toEqual({
      decision: "deny",
      reason: "mode_denied",
    });
    expect(decide({ env: offlineEnv({ APEX_PE5_ACQUISITION_MODE: undefined }) })).toEqual({
      decision: "deny",
      reason: "mode_denied",
    });
  });

  it("denies an unknown mode and a differently cased offline value", () => {
    expect(decide({ env: offlineEnv({ APEX_PE5_ACQUISITION_MODE: "live" }) })).toEqual({
      decision: "deny",
      reason: "mode_denied",
    });
    expect(decide({ env: offlineEnv({ APEX_PE5_ACQUISITION_MODE: "OFFLINE" }) })).toEqual({
      decision: "deny",
      reason: "mode_denied",
    });
  });

  it("approval-mismatch denies when the approval mode disagrees", () => {
    expect(decide({ approval: approval({ mode: "pilot" }) })).toEqual({
      decision: "deny",
      reason: "approval_inconsistent",
    });
  });

  it("approval-expired denies when the ledger clock is at or past expiry", () => {
    expect(decide({ approval: approval({ expiry: NOW - 1 }) })).toEqual({
      decision: "deny",
      reason: "approval_expired",
    });
    expect(decide({ approval: approval({ expiry: NOW }) })).toEqual({
      decision: "deny",
      reason: "approval_expired",
    });
  });

  it("protocol-flags denies when any supplied flag is true", () => {
    for (const key of PROTOCOL_FLAG_KEYS) {
      expect(decide({ protocolFlags: openFlags({ [key]: true }) })).toEqual({
        decision: "deny",
        reason: "protocol_flag_violation",
      });
    }
  });

  it("a supplied false cannot override a restrictive process flag", () => {
    overlayRealFlags({ productionWiring: true });
    expect(decide({ protocolFlags: openFlags() })).toEqual({
      decision: "deny",
      reason: "protocol_flag_violation",
    });

    overlayRealFlags({ acquisitionAuthorized: true });
    expect(decide({ protocolFlags: openFlags() })).toEqual({
      decision: "deny",
      reason: "protocol_flag_violation",
    });

    overlayRealFlags({ collectorAuthorized: true });
    expect(decide({ protocolFlags: openFlags() })).toEqual({
      decision: "deny",
      reason: "protocol_flag_violation",
    });

    overlayRealFlags({ pe53Authorized: true });
    expect(decide({ protocolFlags: openFlags() })).toEqual({
      decision: "deny",
      reason: "protocol_flag_violation",
    });

    overlayRealFlags({ liveProviderAuthorized: true });
    expect(decide({ protocolFlags: openFlags() })).toEqual({
      decision: "deny",
      reason: "protocol_flag_violation",
    });
  });

  it("denies when a real protocol flag is not the boolean false", () => {
    for (const value of [undefined, "false", 1, null]) {
      overlayRealFlags({ productionWiring: value });
      expect(decide({ protocolFlags: openFlags() })).toEqual({
        decision: "deny",
        reason: "protocol_flag_violation",
      });
      overlayRealFlags({ liveProviderAuthorized: value });
      expect(decide({ protocolFlags: openFlags() })).toEqual({
        decision: "deny",
        reason: "protocol_flag_violation",
      });
    }
  });

  it("denies a supplied flag that is not the boolean false", () => {
    for (const value of [undefined, "false", 1, null, 0]) {
      const flags = openFlags();
      Object.defineProperty(flags, "pe53Authorized", {
        value,
        enumerable: true,
        configurable: true,
        writable: true,
      });
      expect(decide({ protocolFlags: flags })).toEqual({
        decision: "deny",
        reason: "protocol_flag_violation",
      });
    }

    const missing: Record<string, boolean> = { ...openFlags() };
    delete missing.pe53Authorized;
    expect(decide({ protocolFlags: missing })).toEqual({
      decision: "deny",
      reason: "protocol_flag_violation",
    });
    expect(decide({ protocolFlags: null })).toEqual({
      decision: "deny",
      reason: "protocol_flag_violation",
    });
  });

  it("reads the real protocol flags, which stay restrictive-closed", () => {
    const protocol = pe5Protocol();
    expect(PE5_PRODUCTION_WIRING).toBe(false);
    expect(protocol.productionWiring).toBe(false);
    expect(protocol.acquisitionAuthorized).toBe(false);
    expect(protocol.collectorAuthorized).toBe(false);
    expect(protocol.pe53Authorized).toBe(false);
    expect(PE53B_LIVE_PROVIDER_AUTHORIZED).toBe(false);
    expect(readRealProtocolFlags()).toEqual(openFlags());
  });

  it("protocol flag denial wins before a missing mode is considered", () => {
    expect(
      decide({
        env: {},
        protocolFlags: openFlags({ pe53Authorized: true }),
      }),
    ).toEqual({ decision: "deny", reason: "protocol_flag_violation" });
  });

  it("pilot-not-authorized denies a well-formed pilot approval", () => {
    expect(
      decide({
        env: offlineEnv({ APEX_PE5_ACQUISITION_MODE: "pilot" }),
        approval: approval({ mode: "pilot" }),
      }),
    ).toEqual({ decision: "deny", reason: "pilot_not_authorized" });
  });

  it("pilot mode with an offline approval is inconsistent", () => {
    expect(
      decide({
        env: offlineEnv({ APEX_PE5_ACQUISITION_MODE: "pilot" }),
        approval: approval({ mode: "offline" }),
      }),
    ).toEqual({ decision: "deny", reason: "approval_inconsistent" });
  });

  it("two-ledgers denies when the configured instance differs", () => {
    expect(decide({ env: offlineEnv({ ledgerInstanceId: "ledger-b" }) })).toEqual({
      decision: "deny",
      reason: "ledger_instance_mismatch",
    });
  });

  it("denies a missing configured ledger id", () => {
    expect(decide({ env: { APEX_PE5_ACQUISITION_MODE: "offline" } })).toEqual({
      decision: "deny",
      reason: "ledger_instance_mismatch",
    });
  });

  it("kill-before-reserve denies a missing or engaged switch", () => {
    expect(decide({ kill: null })).toEqual({
      decision: "deny",
      reason: "kill_switch_engaged",
    });
    expect(decide({ kill: { state: "engaged", version: 1, updatedAt: NOW } })).toEqual({
      decision: "deny",
      reason: "kill_switch_engaged",
    });
  });

  it("denies an unreadable kill switch", () => {
    expect(decide({ kill: { state: "unreadable" } })).toEqual({
      decision: "deny",
      reason: "kill_switch_unreadable",
    });
    expect(decide({ kill: "clear" })).toEqual({
      decision: "deny",
      reason: "kill_switch_unreadable",
    });
  });

  it("kill-stale denies a clear record older than maxAgeMs", () => {
    expect(
      decide({
        kill: clearKill({ updatedAt: NOW - MAX_AGE_MS - 1 }),
      }),
    ).toEqual({ decision: "deny", reason: "kill_switch_stale" });
  });

  it("accepts a clear record at the freshness boundary and rejects a future stamp", () => {
    expect(decide({ kill: clearKill({ updatedAt: NOW - MAX_AGE_MS }) })).toEqual({
      decision: "allow-offline",
    });
    expect(decide({ kill: clearKill({ updatedAt: NOW + 1 }) })).toEqual({
      decision: "deny",
      reason: "kill_switch_stale",
    });
  });

  it("denies a non-integer kill version", () => {
    expect(decide({ kill: clearKill({ version: 1.5 }) })).toEqual({
      decision: "deny",
      reason: "kill_switch_engaged",
    });
  });

  it("denies when the approval and kill freshness bounds disagree", () => {
    expect(decide({ approval: approval({ maxAgeMs: MAX_AGE_MS + 1 }) })).toEqual({
      decision: "deny",
      reason: "approval_inconsistent",
    });
  });

  it.each([
    "researchCeiling",
    "dailyCeiling",
    "rateCeiling",
    "rateWindowMs",
    "leaseMs",
    "fetchTimeoutMs",
    "maxAgeMs",
    "expiry",
    "credentialId",
    "ledgerInstanceId",
    "operator",
    "mode",
  ])("missing %s denies authorization", (field) => {
    const record = approval();
    delete record[field];
    expect(decide({ approval: record })).toEqual({
      decision: "deny",
      reason: "approval_missing",
    });
  });

  it("missing approval object denies authorization", () => {
    expect(decide({ approval: null })).toEqual({
      decision: "deny",
      reason: "approval_missing",
    });
  });

  it.each([
    ["dailyCeiling", 0],
    ["dailyCeiling", -1],
    ["dailyCeiling", 1.5],
    ["dailyCeiling", "5"],
    ["researchCeiling", 0],
    ["rateCeiling", Number.NaN],
    ["rateWindowMs", 0],
    ["maxAgeMs", -5],
    ["leaseMs", 1.2],
    ["fetchTimeoutMs", 0],
    ["expiry", "2026-01-01T00:00:00.000Z"],
  ] as const)("invalid %s denies authorization", (field, value) => {
    expect(decide({ approval: approval({ [field]: value }) })).toEqual({
      decision: "deny",
      reason: "approval_invalid",
    });
  });

  it("denies a lease that is not longer than the fetch timeout", () => {
    expect(decide({ approval: approval({ leaseMs: 1_000, fetchTimeoutMs: 1_000 }) })).toEqual({
      decision: "deny",
      reason: "approval_invalid",
    });
  });

  it("denies an approval that carries a secret field", () => {
    expect(decide({ approval: approval({ API_FOOTBALL_KEY: "not-a-real-secret" }) })).toEqual({
      decision: "deny",
      reason: "approval_invalid",
    });
  });

  it("denies a non-enumerable secret-like approval field", () => {
    const record = approval();
    Object.defineProperty(record, "api_key", {
      value: "hidden-field",
      enumerable: false,
      configurable: true,
      writable: true,
    });
    expect(Object.keys(record).includes("api_key")).toBe(false);
    expect(decide({ approval: record })).toEqual({
      decision: "deny",
      reason: "approval_invalid",
    });
  });

  it("denies an accessor on a flag without calling it", () => {
    let reads = 0;
    const flags = openFlags();
    Object.defineProperty(flags, "pe53Authorized", {
      configurable: true,
      enumerable: true,
      get() {
        reads += 1;
        return false;
      },
    });
    expect(decide({ protocolFlags: flags })).toEqual({
      decision: "deny",
      reason: "protocol_flag_violation",
    });
    expect(reads).toBe(0);
  });

  it("denies an unusable ledger clock", () => {
    expect(decide({ now: NOW + 0.5 })).toEqual({
      decision: "deny",
      reason: "clock_unavailable",
    });
  });

  it("does not read the process environment or name a provider client", () => {
    const source = readFileSync(
      path.join(
        process.cwd(),
        "lib/debug/calibration/pe5-acquisition-boundary/authorize.ts",
      ),
      "utf8",
    );
    expect(source.includes("process.env")).toBe(false);
    expect(source.includes("fetch(")).toBe(false);
    expect(source.includes("createApiFootballClient")).toBe(false);
    expect(source.includes("API_FOOTBALL")).toBe(false);
  });
});

/**
 * PE-5.4C increment 1 — authorization types.
 * Research-only. No transport, ledger, or credential handling.
 */

export const AUTHORIZATION_DENY_REASONS = [
  "protocol_flag_violation",
  "clock_unavailable",
  "kill_switch_unreadable",
  "kill_switch_engaged",
  "kill_switch_stale",
  "mode_denied",
  "approval_missing",
  "approval_expired",
  "approval_inconsistent",
  "approval_invalid",
  "ledger_instance_mismatch",
  "pilot_not_authorized",
] as const;

export type AuthorizationDenyReason = (typeof AUTHORIZATION_DENY_REASONS)[number];

export type AuthorizationDecision =
  | { readonly decision: "deny"; readonly reason: AuthorizationDenyReason }
  | { readonly decision: "allow-offline" };

export const AUTHORIZATION_MODES = ["offline", "pilot"] as const;

export type AuthorizationMode = (typeof AUTHORIZATION_MODES)[number];

/**
 * Caller-supplied view of the process configuration.
 * `evaluateAuthorization` does not read the process environment.
 */
export type AuthorizationEnv = {
  readonly APEX_PE5_ACQUISITION_MODE?: string;
  readonly ledgerInstanceId?: string;
};

export const PROTOCOL_FLAG_KEYS = [
  "PE5_PRODUCTION_WIRING",
  "acquisitionAuthorized",
  "collectorAuthorized",
  "pe53Authorized",
  "PE53B_LIVE_PROVIDER_AUTHORIZED",
] as const;

export type ProtocolFlagKey = (typeof PROTOCOL_FLAG_KEYS)[number];

export type ProtocolFlagSnapshot = {
  readonly [Key in ProtocolFlagKey]: boolean;
};

/**
 * Instants are ledger-clock epoch milliseconds.
 * Ceilings are counts. Durations are milliseconds.
 * `credentialId` is an identifier, never a provider secret.
 *
 * `vendorDayBoundary` is an offline accounting rule for one fixed
 * 24-hour cycle. A label derived from it is not a verified provider
 * civil date or quota reset. Null means the boundary is absent.
 */
export type VendorDayBoundary = {
  readonly version: 1;
  readonly utcOffsetMs: number;
  readonly resetOffsetMs: number;
};

export type AcquisitionApproval = {
  readonly mode: AuthorizationMode;
  readonly credentialId: string;
  readonly ledgerInstanceId: string;
  readonly operator: string;
  readonly researchCeiling: number;
  readonly dailyCeiling: number;
  readonly rateCeiling: number;
  readonly rateWindowMs: number;
  readonly leaseMs: number;
  readonly fetchTimeoutMs: number;
  readonly maxAgeMs: number;
  readonly expiry: number;
  readonly vendorDayBoundary: VendorDayBoundary | null;
};

export type ClearKillSwitch = {
  readonly state: "clear";
  readonly version: number;
  readonly updatedAt: number;
  readonly maxAgeMs: number;
};

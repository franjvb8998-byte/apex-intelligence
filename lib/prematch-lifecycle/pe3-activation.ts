/**
 * PE-3B / PE-3C / PE-3F activation gate for lifecycle PE inputs.
 *
 * PE-3C wires the C0 candidate path into runPrematchLifecycle, but
 * PE3C_C0_RECON_ACTIVATION remains false in default production.
 *
 * PE-3F adds a manual-only CLI smoke that injects peInputMode=c0_recon
 * without flipping this constant. Scheduled lifecycle:prematch stays BASE.
 *
 * Tests may inject peInputMode via PrematchLifecycleDependencies —
 * they must not mutate this constant.
 */

/** Flip to `true` only in an explicit controlled production activation. */
export const PE3C_C0_RECON_ACTIVATION: boolean = false;

export type LifecyclePeInputMode = "base_prior" | "c0_recon";

/**
 * Default production input mode. Always base_prior while activation is false.
 * Prefer deps.peInputMode for test seams.
 */
export function resolveLifecyclePeInputMode(): LifecyclePeInputMode {
  return PE3C_C0_RECON_ACTIVATION ? "c0_recon" : "base_prior";
}

export function isC0ReconLifecycleActivated(): boolean {
  return resolveLifecyclePeInputMode() === "c0_recon";
}

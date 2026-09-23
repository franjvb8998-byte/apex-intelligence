export type PrematchLifecycleReport = {
  startedAtUtc: string;
  completedAtUtc: string;
  configuredLeagueCount: number;
  leagueAllowlistInvalid: boolean;
  discoveredFixtureCount: number;
  eligibleT120Count: number;
  alreadyTicketedCount: number;
  newTicketAttempts: number;
  newTicketsCreated: number;
  newTicketsIdempotent: number;
  oddsRequests: number;
  peComputations: number;
  ticketListPages: number;
  finalizationCandidates: number;
  finalizationBatchRequests: number;
  evidenceCreated: number;
  evidenceIdempotent: number;
  evaluationsCreated: number;
  /**
   * Evaluation insert-if-absent that found an existing row during THIS run,
   * or a this-run lookup that already had an evaluation. Not a lifetime total.
   */
  evaluationsIdempotent: number;
  /** Void terminals newly observed during THIS run. */
  voidTerminalCount: number;
  invalidFixtureIdCount: number;
  skippedCount: number;
  /** Total observed errors (isolated + run-level). Additive; not an exit signal alone. */
  errorCount: number;
  /**
   * Run-level operational failures that should fail a scheduler job red.
   * Does not include ordinary isolated per-fixture/item errors.
   * Aggregate counter only — never carries exception text or payloads.
   */
  fatalErrorCount: number;
  /**
   * Resolved PE input mode for this run (`base_prior` | `c0_recon`).
   * Observable proof of whether C0 path was selected.
   */
  peInputMode: "base_prior" | "c0_recon";
  /**
   * Canonical input regime label for this run
   * (REGIME_LIFECYCLE_BASE_PRIOR_V1 | REGIME_LIFECYCLE_C0_RECON_V1).
   */
  inputRegime: string;
  /** PE-3C: C0 reconstruction attempts (mode=c0_recon only). */
  c0ReconAttempts: number;
  c0ReconTicketsCreated: number;
  c0ReconFallbackBasePrior: number;
  c0ReconMixed: number;
  c0ReconSkipped: number;
  /** Logical season-universe acquisitions (one per league+season key). */
  seasonUniverseAcquisitions: number;
  /** HTTP page requests across season-universe acquisitions. */
  seasonUniverseHttpRequests: number;
  /**
   * @deprecated Alias of seasonUniverseAcquisitions (PE-3C compat).
   */
  seasonUniverseRequests: number;
  seasonUniverseCacheHits: number;
  /** Last C0 skip reason in this run (bounded enum string); empty if none. */
  c0LastSkipReason: string | null;
};

export function emptyPrematchLifecycleReport(
  startedAtUtc: string,
  configuredLeagueCount: number,
): PrematchLifecycleReport {
  return {
    startedAtUtc,
    completedAtUtc: startedAtUtc,
    configuredLeagueCount,
    leagueAllowlistInvalid: false,
    discoveredFixtureCount: 0,
    eligibleT120Count: 0,
    alreadyTicketedCount: 0,
    newTicketAttempts: 0,
    newTicketsCreated: 0,
    newTicketsIdempotent: 0,
    oddsRequests: 0,
    peComputations: 0,
    ticketListPages: 0,
    finalizationCandidates: 0,
    finalizationBatchRequests: 0,
    evidenceCreated: 0,
    evidenceIdempotent: 0,
    evaluationsCreated: 0,
    evaluationsIdempotent: 0,
    voidTerminalCount: 0,
    invalidFixtureIdCount: 0,
    skippedCount: 0,
    errorCount: 0,
    fatalErrorCount: 0,
    peInputMode: "base_prior",
    inputRegime: "REGIME_LIFECYCLE_BASE_PRIOR_V1",
    c0ReconAttempts: 0,
    c0ReconTicketsCreated: 0,
    c0ReconFallbackBasePrior: 0,
    c0ReconMixed: 0,
    c0ReconSkipped: 0,
    seasonUniverseAcquisitions: 0,
    seasonUniverseHttpRequests: 0,
    seasonUniverseRequests: 0,
    seasonUniverseCacheHits: 0,
    c0LastSkipReason: null,
  };
}

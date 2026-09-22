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
  errorCount: number;
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
  };
}

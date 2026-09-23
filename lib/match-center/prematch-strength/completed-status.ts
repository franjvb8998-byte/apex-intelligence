/**
 * Completed-evidence statuses for PE-3A reconstruction.
 * Mirrors calibration FORBIDDEN_FINAL_STATUSES used as countable completed results:
 * FT, AET, PEN only.
 */

const COMPLETED_EVIDENCE_STATUSES = new Set(["FT", "AET", "PEN"]);

function normalizeStatus(status: string): string {
  return status.trim().toUpperCase().replace(/[\s-]+/g, "_");
}

/**
 * True when the fixture is a trustworthy completed regulation/extra-time/penalties result.
 */
export function isCompletedPrematchEvidenceStatus(status: string): boolean {
  if (typeof status !== "string" || status.length === 0) return false;
  return COMPLETED_EVIDENCE_STATUSES.has(normalizeStatus(status));
}

/**
 * Missing-stat Elo prior (Sprint 5B.1).
 *
 * Team / provider IDs are not football strength. When catalogue stats are
 * absent, return `base` unchanged. Home/away bases (1580 / 1520) stay with
 * the caller — this helper must not invent a checksum offset.
 *
 * `teamId` is kept in the signature for call-site compatibility only.
 */

export function estimateEloFromTeamId(_teamId: string, base = 1500): number {
  return base;
}

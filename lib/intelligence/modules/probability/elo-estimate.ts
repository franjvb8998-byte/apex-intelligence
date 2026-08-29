/**
 * Deterministic pseudo-Elo when no EloRatingProvider / catalogue ratings exist.
 * TODO(elo-provider): replace with persisted ratings after each finished match.
 */

export function estimateEloFromTeamId(teamId: string, base = 1500): number {
  let hash = 0;
  for (let i = 0; i < teamId.length; i++) {
    hash = (hash * 31 + teamId.charCodeAt(i)) >>> 0;
  }
  return base + (hash % 251) - 125;
}

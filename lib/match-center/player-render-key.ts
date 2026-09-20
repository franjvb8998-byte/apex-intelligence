/**
 * Deterministic React / view-model keys for API-Football players.
 * Does not invent a provider player identity when the vendor id is null.
 */

export function apiFootballPlayerRenderKey(input: {
  teamId: string | number;
  slot: "xi" | "sub" | "squad";
  index: number;
  playerId: number | string | null | undefined;
}): string {
  if (input.playerId != null && String(input.playerId) !== "") {
    const suffix = input.slot === "sub" ? `:sub:${input.index}` : `:${input.index}`;
    return `apex:api-football:player:${input.playerId}${suffix}`;
  }
  return `apex:api-football:player:slot:${input.teamId}:${input.slot}:${input.index}`;
}

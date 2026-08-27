/**
 * Pure mappers for Match Center team context (form, H2H, absences, lineups).
 */

import type { ApiFootballFixtureItem } from "@/lib/data-platform/providers/api-football/types";
import type { ApiFootballInjuryItem } from "@/lib/data-platform/providers/api-football/types";
import type { ApiFootballLineup } from "@/lib/data-platform/providers/api-football/types";
import type {
  MatchCenterAbsence,
  MatchCenterH2HMeeting,
  MatchCenterLineup,
  MatchCenterRecentMatch,
} from "@/lib/match-center/types";

export function isSuspensionAbsence(
  type?: string | null,
  reason?: string | null,
): boolean {
  const blob = `${type ?? ""} ${reason ?? ""}`.toLowerCase();
  return /suspend|sidelin|\bbanned\b|red card|\bban\b/.test(blob);
}

export function formLettersFromRecent(
  matches: MatchCenterRecentMatch[],
): string | null {
  const letters = matches
    .map((match) => match.result)
    .filter((result): result is "W" | "D" | "L" => result != null);
  return letters.length > 0 ? letters.join("") : null;
}

export function resultFromScores(
  goalsFor: number | null,
  goalsAgainst: number | null,
): "W" | "D" | "L" | null {
  if (goalsFor == null || goalsAgainst == null) return null;
  if (goalsFor > goalsAgainst) return "W";
  if (goalsFor < goalsAgainst) return "L";
  return "D";
}

export function recentMatchesFromFixtures(
  items: ApiFootballFixtureItem[],
  teamExternalId: string,
  currentFixtureId?: string | null,
): MatchCenterRecentMatch[] {
  return items
    .filter((item) => String(item.fixture.id) !== currentFixtureId)
    .slice(0, 5)
    .map((item) => {
      const homeId = String(item.teams.home.id);
      const isHome = homeId === teamExternalId;
      const goalsFor = isHome ? item.goals.home : item.goals.away;
      const goalsAgainst = isHome ? item.goals.away : item.goals.home;
      return {
        id: String(item.fixture.id),
        kickoffAt: item.fixture.date,
        opponentName: isHome ? item.teams.away.name : item.teams.home.name,
        home: isHome,
        goalsFor,
        goalsAgainst,
        result: resultFromScores(goalsFor, goalsAgainst),
      };
    });
}

export function h2hFromFixtures(
  items: ApiFootballFixtureItem[],
  currentFixtureId?: string | null,
): MatchCenterH2HMeeting[] {
  return items
    .filter((item) => String(item.fixture.id) !== currentFixtureId)
    .slice(0, 5)
    .map((item) => ({
      id: String(item.fixture.id),
      kickoffAt: item.fixture.date,
      homeTeamName: item.teams?.home?.name ?? "Local",
      awayTeamName: item.teams?.away?.name ?? "Visitante",
      homeGoals: item.goals?.home ?? null,
      awayGoals: item.goals?.away ?? null,
    }));
}

export function absencesFromInjuries(
  items: ApiFootballInjuryItem[],
): { injuries: MatchCenterAbsence[]; suspensions: MatchCenterAbsence[] } {
  const injuries: MatchCenterAbsence[] = [];
  const suspensions: MatchCenterAbsence[] = [];
  items.forEach((item, index) => {
    const absence: MatchCenterAbsence = {
      id: `abs-${item.player?.id ?? index}`,
      playerName: item.player?.name ?? "Jugador",
      teamId:
        item.team?.id != null
          ? `apex:api-football:team:${item.team.id}`
          : null,
      teamName: item.team?.name ?? null,
      detail:
        [item.player?.type, item.player?.reason].filter(Boolean).join(" · ") ||
        "Ausencia reportada por el proveedor.",
    };
    if (isSuspensionAbsence(item.player?.type, item.player?.reason)) {
      suspensions.push(absence);
    } else {
      injuries.push(absence);
    }
  });
  return { injuries, suspensions };
}

export function lineupFromVendor(
  lineup: ApiFootballLineup | undefined,
): MatchCenterLineup | null {
  if (!lineup) return null;
  const startXI = (lineup.startXI ?? []).map((row, index) => ({
    id: `apex:api-football:player:${row.player.id}:${index}`,
    name: row.player.name,
    number: row.player.number ?? null,
    position: row.player.pos ?? null,
  }));
  const substitutes = (lineup.substitutes ?? []).map((row, index) => ({
    id: `apex:api-football:player:${row.player.id}:sub:${index}`,
    name: row.player.name,
    number: row.player.number ?? null,
    position: row.player.pos ?? null,
  }));
  if (startXI.length === 0 && substitutes.length === 0 && !lineup.formation) {
    return null;
  }
  return {
    teamId: `apex:api-football:team:${lineup.team.id}`,
    teamName: lineup.team.name,
    formation: lineup.formation ?? null,
    startXI,
    substitutes,
  };
}

export function lineupsFromVendor(
  lineups: ApiFootballLineup[],
  homeTeamExternalId: string,
  awayTeamExternalId: string,
): { home: MatchCenterLineup | null; away: MatchCenterLineup | null } {
  const home = lineups.find(
    (item) => String(item.team.id) === homeTeamExternalId,
  );
  const away = lineups.find(
    (item) => String(item.team.id) === awayTeamExternalId,
  );
  return {
    home: lineupFromVendor(home),
    away: lineupFromVendor(away),
  };
}

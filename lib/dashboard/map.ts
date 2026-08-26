/**
 * Map ApexMatchBundle → Dashboard DTOs.
 */

import type { ApexMatchBundle } from "@/lib/data-platform/types/bundle";
import type { ApexMatchStatus } from "@/lib/data-platform/types/match";
import type {
  DashboardLeagueSummary,
  DashboardMatchStatus,
  DashboardMatchSummary,
  DashboardTeamSummary,
} from "@/lib/dashboard/types";

function mapStatus(status: ApexMatchStatus): DashboardMatchStatus {
  switch (status) {
    case "scheduled":
      return "scheduled";
    case "live":
      return "live";
    case "finished":
      return "finished";
    case "postponed":
      return "postponed";
    case "cancelled":
      return "cancelled";
    default:
      return "unknown";
  }
}

export function matchSummaryFromBundle(
  bundle: ApexMatchBundle,
): DashboardMatchSummary {
  return {
    id: bundle.match.id,
    externalId: bundle.match.externalRefs[0]?.externalId ?? null,
    kickoffAt: bundle.match.kickoffAt,
    status: mapStatus(bundle.match.status),
    leagueName: bundle.league?.name ?? null,
    homeTeam: {
      id: bundle.homeTeam.id,
      name: bundle.homeTeam.name,
      shortName: bundle.homeTeam.shortName,
    },
    awayTeam: {
      id: bundle.awayTeam.id,
      name: bundle.awayTeam.name,
      shortName: bundle.awayTeam.shortName,
    },
    score: {
      home: bundle.match.score.home,
      away: bundle.match.score.away,
    },
  };
}

export function leagueSummaryFromBundle(
  bundle: ApexMatchBundle,
): DashboardLeagueSummary | null {
  if (!bundle.league) return null;
  return {
    id: bundle.league.id,
    externalId: bundle.league.externalRefs[0]?.externalId ?? null,
    name: bundle.league.name,
    country: bundle.league.country,
    season: bundle.league.season,
  };
}

export function teamsFromBundle(bundle: ApexMatchBundle): DashboardTeamSummary[] {
  const leagueName = bundle.league?.name ?? null;
  return [
    {
      id: bundle.homeTeam.id,
      externalId: bundle.homeTeam.externalRefs[0]?.externalId ?? null,
      name: bundle.homeTeam.name,
      shortName: bundle.homeTeam.shortName,
      crestUrl: bundle.homeTeam.crestUrl,
      leagueName,
    },
    {
      id: bundle.awayTeam.id,
      externalId: bundle.awayTeam.externalRefs[0]?.externalId ?? null,
      name: bundle.awayTeam.name,
      shortName: bundle.awayTeam.shortName,
      crestUrl: bundle.awayTeam.crestUrl,
      leagueName,
    },
  ];
}

export function uniqueById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    out.push(item);
  }
  return out;
}

export function startOfUtcDay(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export function addUtcDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function isUpcomingMatch(
  match: DashboardMatchSummary,
  now = new Date(),
): boolean {
  if (match.status === "finished" || match.status === "cancelled") return false;
  if (match.status === "live") return true;
  const kickoff = Date.parse(match.kickoffAt);
  if (!Number.isFinite(kickoff)) return match.status === "scheduled";
  return kickoff >= now.getTime() - 3 * 60 * 60 * 1000;
}

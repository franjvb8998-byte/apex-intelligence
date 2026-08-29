/**
 * League / competition labels for bankroll match strings.
 * Fixtures win when both team names match. Otherwise known clubs in the ledger.
 */

import { matchLabel } from "@/lib/bankroll/match-search";
import type { BankrollBet, BankrollFixture } from "@/lib/bankroll/types";
import type { ClassifiedBet } from "@/lib/portfolio/types";

type ClubMeta = {
  league: string;
  competition: string;
};

const UNCLASSIFIED = "Unclassified";

const CLUBS: Record<string, ClubMeta> = {
  arsenal: { league: "Premier League", competition: "England" },
  chelsea: { league: "Premier League", competition: "England" },
  liverpool: { league: "Premier League", competition: "England" },
  everton: { league: "Premier League", competition: "England" },
  "manchester city": { league: "Premier League", competition: "England" },
  tottenham: { league: "Premier League", competition: "England" },
  newcastle: { league: "Premier League", competition: "England" },
  brighton: { league: "Premier League", competition: "England" },
  "manchester united": { league: "Premier League", competition: "England" },
  barcelona: { league: "La Liga", competition: "Spain" },
  girona: { league: "La Liga", competition: "Spain" },
  "real madrid": { league: "La Liga", competition: "Spain" },
  athletic: { league: "La Liga", competition: "Spain" },
  "atlético": { league: "La Liga", competition: "Spain" },
  atletico: { league: "La Liga", competition: "Spain" },
  sevilla: { league: "La Liga", competition: "Spain" },
  inter: { league: "Serie A", competition: "Italy" },
  napoli: { league: "Serie A", competition: "Italy" },
  juventus: { league: "Serie A", competition: "Italy" },
  milan: { league: "Serie A", competition: "Italy" },
  bayern: { league: "Bundesliga", competition: "Germany" },
  dortmund: { league: "Bundesliga", competition: "Germany" },
  psg: { league: "Ligue 1", competition: "France" },
  marseille: { league: "Ligue 1", competition: "France" },
  portugal: { league: "International", competition: "International" },
  españa: { league: "International", competition: "International" },
  espana: { league: "International", competition: "International" },
  francia: { league: "International", competition: "International" },
  "países bajos": { league: "International", competition: "International" },
  "paises bajos": { league: "International", competition: "International" },
};

export function normalizeName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function parseMatchSides(match: string): { home: string; away: string } {
  const parts = match.split(/\s+vs\s+/i).map((part) => part.trim()).filter(Boolean);
  if (parts.length >= 2) {
    return { home: parts[0]!, away: parts.slice(1).join(" vs ") };
  }
  return { home: match.trim() || "Unknown", away: "Unknown" };
}

function clubMeta(name: string): ClubMeta | null {
  return CLUBS[normalizeName(name)] ?? null;
}

function metaForSides(home: string, away: string): ClubMeta {
  const a = clubMeta(home);
  const b = clubMeta(away);
  if (a && b && a.league === b.league) return a;
  if (a && b) {
    return { league: UNCLASSIFIED, competition: UNCLASSIFIED };
  }
  return a ?? b ?? { league: UNCLASSIFIED, competition: UNCLASSIFIED };
}

function fixtureForMatch(
  home: string,
  away: string,
  fixtures: BankrollFixture[],
): BankrollFixture | null {
  const needleHome = normalizeName(home);
  const needleAway = normalizeName(away);
  return (
    fixtures.find((fixture) => {
      const label = normalizeName(matchLabel(fixture));
      const fh = normalizeName(fixture.homeTeam.name);
      const fa = normalizeName(fixture.awayTeam.name);
      return (
        (fh === needleHome && fa === needleAway) ||
        label === `${needleHome} vs ${needleAway}`
      );
    }) ?? null
  );
}

export function classifyBet(
  bet: BankrollBet,
  fixtures: BankrollFixture[] = [],
): ClassifiedBet {
  const { home, away } = parseMatchSides(bet.match);
  const fixture = fixtureForMatch(home, away, fixtures);
  if (fixture?.leagueName?.trim()) {
    const club = metaForSides(home, away);
    return {
      bet,
      home,
      away,
      league: fixture.leagueName.trim(),
      competition: club.competition === UNCLASSIFIED ? fixture.leagueName.trim() : club.competition,
    };
  }
  const meta = metaForSides(home, away);
  return {
    bet,
    home,
    away,
    league: meta.league,
    competition: meta.competition,
  };
}

export function classifyBets(
  bets: BankrollBet[],
  fixtures: BankrollFixture[] = [],
): ClassifiedBet[] {
  return bets.map((bet) => classifyBet(bet, fixtures));
}

export function teamWeights(classified: ClassifiedBet): Array<{ team: string; weight: number }> {
  const market = classified.bet.market.toLowerCase();
  if (market.includes("local") || market.includes("home")) {
    return [{ team: classified.home, weight: 1 }];
  }
  if (market.includes("visitante") || market.includes("away")) {
    return [{ team: classified.away, weight: 1 }];
  }
  if (market.includes("empate") || market.includes("draw")) {
    return [
      { team: classified.home, weight: 0.5 },
      { team: classified.away, weight: 0.5 },
    ];
  }
  return [
    { team: classified.home, weight: 0.5 },
    { team: classified.away, weight: 0.5 },
  ];
}

/**
 * APEX Team Intelligence — published facts in, digital twin out.
 * Missing catalogue signals stay null. Nothing here invents odds, travel, derbies, or market value.
 */

export type FormLetter = "W" | "D" | "L";

export type PlayingStyleLabel =
  | "possession"
  | "direct"
  | "balanced"
  | "high_press"
  | "low_block";

export type ClubSize = "small" | "medium" | "large";

export type BudgetTier = "elite" | "upper" | "mid" | "limited";

export type MomentumTrend = "improving" | "stable" | "declining";

export type PerformanceDirection = "up" | "flat" | "down";

export type TournamentPriority =
  | "title"
  | "europe"
  | "mid_table"
  | "relegation"
  | "league";

export type PublishedMetric<T> = {
  value: T | null;
  available: boolean;
  note: string;
};

export type PublishedScore = PublishedMetric<number>;

export type AbsenceItem = {
  playerName: string;
  detail: string;
};

export type AbsenceFeed = {
  /** False when the injury/suspension endpoint was not consulted. */
  published: boolean;
  items: AbsenceItem[];
};

export type TransferFeed = {
  published: boolean;
  incoming: number | null;
  outgoing: number | null;
  /** Signed quality delta when a catalogue publishes one; never inferred. */
  estimatedImpact: number | null;
  managerChanged: boolean | null;
  youthPromotions: number | null;
};

export type VenueRecord = {
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number | null;
  goalsAgainst: number | null;
};

export type RecentMatchFact = {
  kickoffAt: string;
  home: boolean;
  goalsFor: number | null;
  goalsAgainst: number | null;
  result: FormLetter | null;
  expectedGoalsFor: number | null;
  expectedGoalsAgainst: number | null;
  possession: number | null;
  shots: number | null;
  corners: number | null;
  cards: number | null;
  opponentName: string | null;
};

export type StyleAxes = {
  /** 0–1 when the Football Graph (or equivalent) published the axis. */
  possession: number | null;
  pressing: number | null;
  directness: number | null;
  width: number | null;
  tempo: number | null;
};

/**
 * Club snapshot assembled by builders from Data Platform / Match Center facts.
 * The engine never fetches HTTP.
 */
export type TeamIntelligenceInput = {
  asOf: string;
  identity: {
    teamId: string;
    name: string;
    shortName: string | null;
    country: string | null;
    leagueName: string | null;
    season: string | null;
    managerName: string | null;
    formation: string | null;
    venueCapacity: number | null;
    venueSurface: string | null;
    logoUrl: string | null;
    /** Only when a catalogue publishes a budget band. */
    budgetTier: BudgetTier | null;
    /** Transfermarkt-style value; never estimated here. */
    marketValue: number | null;
    averageSquadAge: number | null;
  };
  table: {
    rank: number | null;
    points: number | null;
    played: number | null;
    teamsInTable: number | null;
    /** Vendor standing description (e.g. Champions League). */
    description: string | null;
  };
  season: {
    played: number | null;
    wins: number | null;
    draws: number | null;
    losses: number | null;
    goalsFor: number | null;
    goalsAgainst: number | null;
    goalsForAverage: number | null;
    goalsAgainstAverage: number | null;
    cleanSheets: number | null;
    failedToScore: number | null;
    home: VenueRecord | null;
    away: VenueRecord | null;
    form: string | null;
  };
  recent: RecentMatchFact[];
  absences: {
    injuries: AbsenceFeed;
    suspensions: AbsenceFeed;
  };
  squad: {
    listed: number | null;
    starters: number | null;
    bench: number | null;
  };
  schedule: {
    nextKickoffAt: string | null;
    /** Only when a fixture catalogue marks the next match as a derby. */
    nextIsDerby: boolean | null;
    /** Only when a fixture catalogue marks a rivalry. */
    rivalry: boolean | null;
    travelKm: number | null;
  };
  environment: {
    weather: string | null;
    altitudeMeters: number | null;
    refereeName: string | null;
  };
  transfers: TransferFeed;
  /** Football Graph playing-style axes when a style node exists. */
  styleAxes: StyleAxes | null;
  expectedGoalsSeason: {
    for: number | null;
    against: number | null;
  };
};

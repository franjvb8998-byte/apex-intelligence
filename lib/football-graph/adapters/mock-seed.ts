import type {
  CompetitionNode,
  EventNode,
  GraphEdge,
  GraphEntity,
  MatchNode,
  MetricNode,
  PlayerNode,
  PlayingStyleNode,
  RefereeNode,
  StadiumNode,
  TeamNode,
  CoachNode,
} from "@/lib/football-graph/types";

const now = "2026-08-11T20:00:00.000Z";

export const MOCK_COMPETITION: CompetitionNode = {
  id: "comp-epl",
  kind: "competition",
  name: "Premier League",
  country: "England",
  season: "2025/2026",
  tier: 1,
  tags: ["top5"],
};

export const MOCK_STADIUM: StadiumNode = {
  id: "stad-apex",
  kind: "stadium",
  name: "Apex Arena",
  city: "London",
  country: "England",
  capacity: 42000,
};

export const MOCK_REFEREE: RefereeNode = {
  id: "ref-hayes",
  kind: "referee",
  name: "M. Hayes",
  nationality: "England",
};

export const MOCK_HOME: TeamNode = {
  id: "team-nor",
  kind: "team",
  name: "Northbridge FC",
  shortName: "NOR",
  country: "England",
  competitionIds: ["comp-epl"],
};

export const MOCK_AWAY: TeamNode = {
  id: "team-sou",
  kind: "team",
  name: "Southport United",
  shortName: "SOU",
  country: "England",
  competitionIds: ["comp-epl"],
};

export const MOCK_COACH_HOME: CoachNode = {
  id: "coach-nor",
  kind: "coach",
  name: "Elena Costa",
  teamId: "team-nor",
  nationality: "Spain",
};

export const MOCK_PLAYERS: PlayerNode[] = [
  {
    id: "player-reyes",
    kind: "player",
    name: "Reyes",
    teamId: "team-nor",
    position: "fw",
    shirtNumber: 9,
    nationality: "Spain",
  },
  {
    id: "player-blake",
    kind: "player",
    name: "Blake",
    teamId: "team-sou",
    position: "fw",
    shirtNumber: 9,
    nationality: "England",
  },
];

export const MOCK_STYLE_HOME: PlayingStyleNode = {
  id: "style-nor",
  kind: "playing_style",
  name: "High press vertical",
  subjectId: "team-nor",
  axes: {
    possession: 0.58,
    pressing: 0.82,
    directness: 0.64,
    width: 0.71,
    tempo: 0.76,
  },
};

export const MOCK_STYLE_AWAY: PlayingStyleNode = {
  id: "style-sou",
  kind: "playing_style",
  name: "Low block counter",
  subjectId: "team-sou",
  axes: {
    possession: 0.41,
    pressing: 0.38,
    directness: 0.72,
    width: 0.45,
    tempo: 0.52,
  },
};

export const MOCK_MATCH_A: MatchNode = {
  id: "match-a",
  kind: "match",
  name: "NOR vs SOU",
  competitionId: "comp-epl",
  homeTeamId: "team-nor",
  awayTeamId: "team-sou",
  stadiumId: "stad-apex",
  refereeId: "ref-hayes",
  kickoffAt: "2026-08-15T18:00:00.000Z",
  status: "finished",
  homeScore: 2,
  awayScore: 1,
  tags: ["demo"],
};

export const MOCK_MATCH_B: MatchNode = {
  id: "match-b",
  kind: "match",
  name: "NOR vs SOU (earlier)",
  competitionId: "comp-epl",
  homeTeamId: "team-nor",
  awayTeamId: "team-sou",
  stadiumId: "stad-apex",
  refereeId: "ref-hayes",
  kickoffAt: "2026-03-02T16:30:00.000Z",
  status: "finished",
  homeScore: 1,
  awayScore: 1,
  tags: ["demo", "similar-candidate"],
};

export const MOCK_MATCH_C: MatchNode = {
  id: "match-c",
  kind: "match",
  name: "NOR vs SOU (away)",
  competitionId: "comp-epl",
  homeTeamId: "team-sou",
  awayTeamId: "team-nor",
  stadiumId: "stad-apex",
  refereeId: "ref-hayes",
  kickoffAt: "2025-12-10T20:00:00.000Z",
  status: "finished",
  homeScore: 0,
  awayScore: 0,
  tags: ["demo", "low-scoring"],
};

export const MOCK_EVENTS: EventNode[] = [
  {
    id: "evt-a1",
    kind: "event",
    name: "Goal Reyes 23'",
    matchId: "match-a",
    teamId: "team-nor",
    playerId: "player-reyes",
    minute: 23,
    eventType: "goal",
  },
  {
    id: "evt-a2",
    kind: "event",
    name: "Goal Blake 71'",
    matchId: "match-a",
    teamId: "team-sou",
    playerId: "player-blake",
    minute: 71,
    eventType: "goal",
  },
  {
    id: "evt-a3",
    kind: "event",
    name: "Goal Reyes 84'",
    matchId: "match-a",
    teamId: "team-nor",
    playerId: "player-reyes",
    minute: 84,
    eventType: "goal",
  },
  {
    id: "evt-b1",
    kind: "event",
    name: "Goal Reyes 55'",
    matchId: "match-b",
    teamId: "team-nor",
    playerId: "player-reyes",
    minute: 55,
    eventType: "goal",
  },
];

export const MOCK_METRICS: MetricNode[] = [
  {
    id: "met-a-xg-home",
    kind: "metric",
    name: "xG home match-a",
    subjectId: "team-nor",
    matchId: "match-a",
    key: "xg",
    value: 1.92,
    unit: "goals",
  },
  {
    id: "met-a-xg-away",
    kind: "metric",
    name: "xG away match-a",
    subjectId: "team-sou",
    matchId: "match-a",
    key: "xg",
    value: 0.88,
    unit: "goals",
  },
  {
    id: "met-a-ppda",
    kind: "metric",
    name: "PPDA home match-a",
    subjectId: "team-nor",
    matchId: "match-a",
    key: "ppda",
    value: 8.4,
    unit: "ratio",
  },
  {
    id: "met-b-xg-home",
    kind: "metric",
    name: "xG home match-b",
    subjectId: "team-nor",
    matchId: "match-b",
    key: "xg",
    value: 1.45,
    unit: "goals",
  },
  {
    id: "met-c-xg-home",
    kind: "metric",
    name: "xG home match-c",
    subjectId: "team-sou",
    matchId: "match-c",
    key: "xg",
    value: 0.55,
    unit: "goals",
  },
];

function edge(
  id: string,
  type: GraphEdge["type"],
  from: GraphEntity,
  to: GraphEntity,
  weight?: number,
): GraphEdge {
  return {
    id,
    type,
    fromId: from.id,
    fromKind: from.kind,
    toId: to.id,
    toKind: to.kind,
    weight,
    createdAt: now,
  };
}

export function createMockGraphSeed(): {
  nodes: GraphEntity[];
  edges: GraphEdge[];
} {
  const nodes: GraphEntity[] = [
    MOCK_COMPETITION,
    MOCK_STADIUM,
    MOCK_REFEREE,
    MOCK_HOME,
    MOCK_AWAY,
    MOCK_COACH_HOME,
    ...MOCK_PLAYERS,
    MOCK_STYLE_HOME,
    MOCK_STYLE_AWAY,
    MOCK_MATCH_A,
    MOCK_MATCH_B,
    MOCK_MATCH_C,
    ...MOCK_EVENTS,
    ...MOCK_METRICS,
  ];

  const edges: GraphEdge[] = [
    edge("e1", "plays_in", MOCK_HOME, MOCK_COMPETITION),
    edge("e2", "plays_in", MOCK_AWAY, MOCK_COMPETITION),
    edge("e3", "belongs_to", MOCK_PLAYERS[0]!, MOCK_HOME),
    edge("e4", "belongs_to", MOCK_PLAYERS[1]!, MOCK_AWAY),
    edge("e5", "coaches", MOCK_COACH_HOME, MOCK_HOME),
    edge("e6", "hosts", MOCK_STADIUM, MOCK_MATCH_A),
    edge("e7", "referees", MOCK_REFEREE, MOCK_MATCH_A),
    edge("e8", "home_team", MOCK_MATCH_A, MOCK_HOME),
    edge("e9", "away_team", MOCK_MATCH_A, MOCK_AWAY),
    edge("e10", "home_team", MOCK_MATCH_B, MOCK_HOME),
    edge("e11", "away_team", MOCK_MATCH_B, MOCK_AWAY),
    edge("e12", "has_style", MOCK_HOME, MOCK_STYLE_HOME, 1),
    edge("e13", "has_style", MOCK_AWAY, MOCK_STYLE_AWAY, 1),
    ...MOCK_EVENTS.map((evt, i) => {
      const match =
        evt.matchId === MOCK_MATCH_A.id
          ? MOCK_MATCH_A
          : evt.matchId === MOCK_MATCH_B.id
            ? MOCK_MATCH_B
            : MOCK_MATCH_C;
      return edge(`ee-${i}`, "occurred_in", evt, match);
    }),
    ...MOCK_METRICS.map((metric, i) => {
      const subject =
        metric.subjectId === MOCK_HOME.id ? MOCK_HOME : MOCK_AWAY;
      return edge(`em-${i}`, "has_metric", subject, metric);
    }),
  ];

  return { nodes, edges };
}

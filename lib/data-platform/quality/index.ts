import type { DataQualityModule } from "@/lib/data-platform/contracts/data-quality";
import type { ApexMatchBundle } from "@/lib/data-platform/types/bundle";
import type {
  DataTrustBand,
  DataTrustDimensionScore,
  DataTrustScore,
} from "@/lib/data-platform/types/quality";

const WEIGHTS = {
  identity: 0.2,
  schedule: 0.15,
  score: 0.1,
  lineups: 0.15,
  events: 0.15,
  odds: 0.15,
  freshness: 0.1,
} as const;

/**
 * Heuristic Data Trust Score in [0, 1].
 * Deterministic and dependency-free — refine weights via calibration later.
 *
 * TODO(calibration): learn weights from observed ingestion incidents.
 */
export class DefaultDataQualityModule implements DataQualityModule {
  score(bundle: ApexMatchBundle): DataTrustScore {
    const dimensions: DataTrustDimensionScore[] = [
      scoreIdentity(bundle),
      scoreSchedule(bundle),
      scoreScoreboard(bundle),
      scoreLineups(bundle),
      scoreEvents(bundle),
      scoreOdds(bundle),
      scoreFreshness(bundle),
    ];

    const value = clamp01(
      dimensions.reduce((sum, d) => sum + d.score * d.weight, 0),
    );

    return {
      matchId: bundle.match.id,
      value,
      band: toBand(value),
      dimensions,
      scoredAt: new Date().toISOString(),
      primaryProvider: bundle.provenance.primaryProvider,
    };
  }
}

function scoreIdentity(bundle: ApexMatchBundle): DataTrustDimensionScore {
  const notes: string[] = [];
  let score = 1;
  if (!bundle.match.homeTeamId || !bundle.match.awayTeamId) {
    score -= 0.5;
    notes.push("Missing team ids");
  }
  if (bundle.match.homeTeamId === bundle.match.awayTeamId) {
    score -= 0.5;
    notes.push("Home and away team ids collide");
  }
  if (!bundle.league) {
    score -= 0.2;
    notes.push("League missing");
  }
  if (bundle.match.externalRefs.length === 0) {
    score -= 0.2;
    notes.push("No external refs");
  }
  return dim("identity", WEIGHTS.identity, score, notes);
}

function scoreSchedule(bundle: ApexMatchBundle): DataTrustDimensionScore {
  const notes: string[] = [];
  let score = 1;
  if (!bundle.match.kickoffAt || Number.isNaN(Date.parse(bundle.match.kickoffAt))) {
    score = 0;
    notes.push("Invalid kickoffAt");
  }
  if (bundle.match.status === "unknown") {
    score -= 0.3;
    notes.push("Unknown status");
  }
  return dim("schedule", WEIGHTS.schedule, score, notes);
}

function scoreScoreboard(bundle: ApexMatchBundle): DataTrustDimensionScore {
  const notes: string[] = [];
  let score = 0.7;
  const { status, score: s } = bundle.match;
  if (status === "scheduled") {
    score = s.home === null && s.away === null ? 1 : 0.6;
    if (s.home !== null || s.away !== null) {
      notes.push("Scheduled match already has score fields set");
    }
  } else if (status === "live" || status === "finished") {
    score = s.home !== null && s.away !== null ? 1 : 0.3;
    if (s.home === null || s.away === null) {
      notes.push("Live/finished match missing score");
    }
  }
  return dim("score", WEIGHTS.score, score, notes);
}

function scoreLineups(bundle: ApexMatchBundle): DataTrustDimensionScore {
  const notes: string[] = [];
  const count = bundle.players.length;
  let score = 0;
  if (count === 0) {
    notes.push("No players/lineups");
  } else if (count < 4) {
    score = 0.4;
    notes.push("Sparse lineup coverage");
  } else if (count < 22) {
    score = 0.75;
  } else {
    score = 1;
  }
  return dim("lineups", WEIGHTS.lineups, score, notes);
}

function scoreEvents(bundle: ApexMatchBundle): DataTrustDimensionScore {
  const notes: string[] = [];
  const { status } = bundle.match;
  const count = bundle.events.length;
  let score = 0.8;
  if (status === "scheduled") {
    score = count === 0 ? 1 : 0.7;
  } else if (status === "live" || status === "finished") {
    score = count > 0 ? Math.min(1, 0.4 + count * 0.05) : 0.25;
    if (count === 0) notes.push("No timeline events for live/finished match");
  }
  return dim("events", WEIGHTS.events, score, notes);
}

function scoreOdds(bundle: ApexMatchBundle): DataTrustDimensionScore {
  const notes: string[] = [];
  if (bundle.odds.length === 0) {
    return dim("odds", WEIGHTS.odds, 0.2, ["No odds quotes"]);
  }
  const has1x2 = bundle.odds.some((o) => o.market === "1x2");
  let score = has1x2 ? 0.85 : 0.5;
  if (!has1x2) notes.push("Missing 1X2 market");
  if (bundle.odds.some((o) => o.market === "over_under")) {
    score = Math.min(1, score + 0.15);
  }
  return dim("odds", WEIGHTS.odds, score, notes);
}

function scoreFreshness(bundle: ApexMatchBundle): DataTrustDimensionScore {
  const notes: string[] = [];
  const ingested = Date.parse(bundle.match.ingestedAt);
  if (Number.isNaN(ingested)) {
    return dim("freshness", WEIGHTS.freshness, 0.3, ["Invalid ingestedAt"]);
  }
  const ageHours = (Date.now() - ingested) / (1000 * 60 * 60);
  let score = 1;
  if (ageHours > 24) {
    score = 0.6;
    notes.push("Ingest older than 24h");
  }
  if (ageHours > 72) {
    score = 0.3;
    notes.push("Ingest older than 72h");
  }
  return dim("freshness", WEIGHTS.freshness, score, notes);
}

function dim(
  dimension: DataTrustDimensionScore["dimension"],
  weight: number,
  score: number,
  notes: string[],
): DataTrustDimensionScore {
  return {
    dimension,
    weight,
    score: clamp01(score),
    notes,
  };
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function toBand(value: number): DataTrustBand {
  if (value >= 0.75) return "high";
  if (value >= 0.45) return "medium";
  return "low";
}

export function createDataQualityModule(): DataQualityModule {
  return new DefaultDataQualityModule();
}

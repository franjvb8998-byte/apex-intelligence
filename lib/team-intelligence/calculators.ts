/**
 * Layer calculators. Each field is null unless a published fact supports it.
 */

import type {
  CurrentFormLayer,
  EnvironmentLayer,
  MotivationLayer,
  MomentumLayer,
  ScheduleLayer,
  SquadHealthLayer,
  TacticalDnaLayer,
  TeamIdentityLayer,
  TransferIntelligenceLayer,
  VenueDnaLayer,
} from "@/lib/team-intelligence/models";
import {
  clamp,
  daysBetween,
  formLettersFrom,
  formQuality,
  mean,
  metric,
  ms,
  rate,
  round2,
  score,
  unavailable,
  unavailableScore,
  winRate,
} from "@/lib/team-intelligence/normalizers";
import type {
  ClubSize,
  PlayingStyleLabel,
  RecentMatchFact,
  TeamIntelligenceInput,
  TournamentPriority,
  VenueRecord,
} from "@/lib/team-intelligence/types";

const NO_SET_PIECE =
  "Set-piece rating is unpublished. Fixture statistics in the catalogue do not isolate dead-ball xG.";
const NO_CROSSING =
  "Crossing frequency is unpublished. The current fixture-stat parser does not expose crosses.";
const NO_LONG_BALL =
  "Long-ball usage is unpublished. Pass-type splits are not on the Team Intelligence input.";
const NO_HIGH_LINE =
  "High-line rating is unpublished. PPDA / defensive line height are not in the current catalogue.";
const NO_COMPACTNESS =
  "Compactness is unpublished. Defensive block height is not in the current catalogue.";

export function clubSizeFromCapacity(capacity: number | null): ClubSize | null {
  if (capacity == null || !Number.isFinite(capacity) || capacity <= 0) return null;
  if (capacity >= 50_000) return "large";
  if (capacity >= 25_000) return "medium";
  return "small";
}

export function playingStyleFrom(
  input: TeamIntelligenceInput,
  possessionPct: number | null,
): PlayingStyleLabel | null {
  const axes = input.styleAxes;
  if (axes?.pressing != null && axes.pressing >= 0.65) return "high_press";
  if (
    axes?.pressing != null &&
    axes.pressing <= 0.4 &&
    (axes.possession ?? 0) <= 0.45
  ) {
    return "low_block";
  }
  const possession01 =
    axes?.possession ?? (possessionPct != null ? possessionPct / 100 : null);
  if (possession01 == null) return null;
  if (axes?.directness != null && axes.directness >= 0.65 && possession01 < 0.5) {
    return "direct";
  }
  if (possession01 >= 0.55) return "possession";
  if (possession01 <= 0.45) return "direct";
  return "balanced";
}

function axisScore(
  value: number | null,
  note: string,
  asPercent = false,
): ReturnType<typeof score> {
  if (value == null || !Number.isFinite(value)) return unavailableScore(note);
  const pct = asPercent ? value : value * 100;
  return score(pct, note);
}

function gfAvg(input: TeamIntelligenceInput): number | null {
  if (input.season.goalsForAverage != null) return input.season.goalsForAverage;
  const played = input.season.played;
  const gf = input.season.goalsFor;
  if (played != null && played > 0 && gf != null) return gf / played;
  return mean(input.recent.map((row) => row.goalsFor));
}

function gaAvg(input: TeamIntelligenceInput): number | null {
  if (input.season.goalsAgainstAverage != null) {
    return input.season.goalsAgainstAverage;
  }
  const played = input.season.played;
  const ga = input.season.goalsAgainst;
  if (played != null && played > 0 && ga != null) return ga / played;
  return mean(input.recent.map((row) => row.goalsAgainst));
}

function scoredRecent(input: TeamIntelligenceInput): RecentMatchFact[] {
  return input.recent.filter(
    (row) => row.goalsFor != null && row.goalsAgainst != null,
  );
}

export function identityLayer(
  input: TeamIntelligenceInput,
  possessionPct: number | null,
): TeamIdentityLayer {
  return {
    clubName: input.identity.name,
    country: input.identity.country,
    league: input.identity.leagueName,
    season: input.identity.season,
    manager: input.identity.managerName,
    formation: input.identity.formation,
    playingStyle: playingStyleFrom(input, possessionPct),
    budgetTier: input.identity.budgetTier,
    clubSize: clubSizeFromCapacity(input.identity.venueCapacity),
    averageSquadAge: input.identity.averageSquadAge,
    marketValue: input.identity.marketValue,
  };
}

export function tacticalLayer(input: TeamIntelligenceInput): TacticalDnaLayer {
  const attackAvg = gfAvg(input);
  const defendAvg = gaAvg(input);
  const xgFor = input.expectedGoalsSeason.for;
  const xgAgainst = input.expectedGoalsSeason.against;
  const possessionPct = mean(input.recent.map((row) => row.possession));

  const attackFromGoals =
    attackAvg == null ? null : clamp((attackAvg / 2.2) * 100, 0, 100);
  const attackFromXg =
    xgFor == null ? null : clamp((xgFor / 2.3) * 100, 0, 100);
  const attacking =
    attackFromGoals == null && attackFromXg == null
      ? null
      : attackFromXg == null
        ? attackFromGoals
        : attackFromGoals == null
          ? attackFromXg
          : attackFromXg * 0.55 + attackFromGoals * 0.45;

  const defendFromGoals =
    defendAvg == null ? null : clamp((1 - defendAvg / 2.2) * 100, 0, 100);
  const defendFromXg =
    xgAgainst == null ? null : clamp((1 - xgAgainst / 2.2) * 100, 0, 100);
  const defensive =
    defendFromGoals == null && defendFromXg == null
      ? null
      : defendFromXg == null
        ? defendFromGoals
        : defendFromGoals == null
          ? defendFromXg
          : defendFromXg * 0.55 + defendFromGoals * 0.45;

  const axes = input.styleAxes;
  const style = playingStyleFrom(input, possessionPct);
  const counter =
    style === "direct" || style === "low_block"
      ? score(
          clamp(100 - (possessionPct ?? 45), 35, 90),
          "Counter rating follows published direct / low-block identity, not rumours.",
        )
      : style == null
        ? unavailableScore(
            "Counter-attack rating needs possession sample or graph directness.",
          )
        : score(
            clamp((possessionPct ?? 50) * 0.4, 15, 55),
            "Possession identity reduces the counter-attack rating.",
          );

  return {
    attackingStrength: score(
      attacking,
      attacking == null
        ? "No season or recent goals/xG to score attack."
        : `Attack from published goals${xgFor != null ? " and season xG" : ""}.`,
    ),
    defensiveStrength: score(
      defensive,
      defensive == null
        ? "No season or recent goals/xG to score defense."
        : `Defense from published goals against${xgAgainst != null ? " and xGA" : ""}.`,
    ),
    possessionStyle: score(
      possessionPct,
      possessionPct == null
        ? "No possession sample on recent matches."
        : `Mean possession ${possessionPct.toFixed(0)}% on dated matches with the stat.`,
    ),
    pressingIntensity: axisScore(
      axes?.pressing ?? null,
      axes?.pressing == null
        ? "Pressing intensity needs a Football Graph style node (or equivalent)."
        : "Pressing axis from the published style node.",
    ),
    counterAttackRating: counter,
    setPieceRating: unavailableScore(NO_SET_PIECE),
    crossingFrequency: unavailableScore(NO_CROSSING),
    longBallUsage: unavailableScore(NO_LONG_BALL),
    highLine: unavailableScore(NO_HIGH_LINE),
    compactness: unavailableScore(NO_COMPACTNESS),
    tempo: axisScore(
      axes?.tempo ?? null,
      axes?.tempo == null
        ? "Tempo needs a published style axis."
        : "Tempo axis from the published style node.",
    ),
    width: axisScore(
      axes?.width ?? null,
      axes?.width == null
        ? "Width needs a published style axis."
        : "Width axis from the published style node.",
    ),
  };
}

export function formLayer(input: TeamIntelligenceInput): CurrentFormLayer {
  const letters = formLettersFrom(input.season.form, input.recent);
  const last5 = letters.slice(0, 5);
  const last10 = letters.slice(0, 10);
  const scored = scoredRecent(input);
  const sample = scored.length;
  const btts =
    sample === 0
      ? null
      : rate(
          scored.filter(
            (row) => (row.goalsFor ?? 0) > 0 && (row.goalsAgainst ?? 0) > 0,
          ).length,
          sample,
        );
  const over25 =
    sample === 0
      ? null
      : rate(
          scored.filter(
            (row) => (row.goalsFor ?? 0) + (row.goalsAgainst ?? 0) > 2.5,
          ).length,
          sample,
        );
  const q5 = formQuality(last5);
  const q10 = formQuality(last10);
  const xgFor = mean(input.recent.map((row) => row.expectedGoalsFor));
  const xgAgainst = mean(input.recent.map((row) => row.expectedGoalsAgainst));

  return {
    last5,
    last10,
    last5Quality: score(
      q5 == null ? null : q5 * 100,
      q5 == null ? "No last-5 form letters." : "Recency-weighted last 5.",
    ),
    last10Quality: score(
      q10 == null ? null : q10 * 100,
      q10 == null ? "No last-10 form letters." : "Recency-weighted last 10.",
    ),
    goalsScored: metric(
      input.season.goalsFor,
      input.season.goalsFor == null
        ? "Season goals for are unpublished."
        : "Season goals for from team statistics.",
    ),
    goalsConceded: metric(
      input.season.goalsAgainst,
      input.season.goalsAgainst == null
        ? "Season goals against are unpublished."
        : "Season goals against from team statistics.",
    ),
    expectedGoals: metric(
      xgFor ?? input.expectedGoalsSeason.for,
      xgFor != null
        ? "Mean xG on recent matches that published the stat."
        : input.expectedGoalsSeason.for != null
          ? "Season xG from the input snapshot."
          : "xG is unpublished for this club snapshot.",
    ),
    expectedGoalsAgainst: metric(
      xgAgainst ?? input.expectedGoalsSeason.against,
      xgAgainst != null
        ? "Mean xGA on recent matches that published the stat."
        : input.expectedGoalsSeason.against != null
          ? "Season xGA from the input snapshot."
          : "xGA is unpublished for this club snapshot.",
    ),
    cleanSheets: metric(
      input.season.cleanSheets,
      input.season.cleanSheets == null
        ? "Clean sheets are unpublished."
        : "Season clean sheets from team statistics.",
    ),
    bttsFrequency: metric(
      btts,
      btts == null
        ? "Need scored recent matches for BTTS frequency."
        : `BTTS rate on ${sample} dated results.`,
    ),
    over25Frequency: metric(
      over25,
      over25 == null
        ? "Need scored recent matches for Over 2.5 frequency."
        : `Over 2.5 rate on ${sample} dated results.`,
    ),
    corners: metric(
      mean(input.recent.map((row) => row.corners)),
      mean(input.recent.map((row) => row.corners)) == null
        ? "Corners are unpublished on recent matches."
        : "Mean corners on recent matches that published the stat.",
    ),
    cards: metric(
      mean(input.recent.map((row) => row.cards)),
      mean(input.recent.map((row) => row.cards)) == null
        ? "Cards are unpublished on recent matches."
        : "Mean cards on recent matches that published the stat.",
    ),
  };
}

function venueLayer(
  record: VenueRecord | null,
  xg: number | null,
  emptyNote: string,
): VenueDnaLayer {
  if (!record || record.played <= 0) {
    return {
      strength: unavailableScore(emptyNote),
      goals: unavailable(emptyNote),
      expectedGoals: metric(
        xg,
        xg == null ? emptyNote : "xG provided without a venue win record.",
      ),
      winRate: unavailable(emptyNote),
    };
  }
  const wr = winRate(record);
  const gfAvg = record.goalsFor == null ? null : record.goalsFor / record.played;
  const gaAvg = record.goalsAgainst == null ? null : record.goalsAgainst / record.played;
  const fromWins = wr == null ? null : wr * 100;
  const fromGoals =
    gfAvg == null || gaAvg == null
      ? null
      : clamp(50 + (gfAvg - gaAvg) * 18, 0, 100);
  const strength =
    fromWins == null && fromGoals == null
      ? fromWins
      : fromWins == null
        ? fromGoals
        : fromGoals == null
          ? fromWins
          : fromWins * 0.65 + fromGoals * 0.35;

  return {
    strength: score(
      strength,
      `Venue split ${record.wins}W-${record.draws}D-${record.losses}L in ${record.played}.`,
    ),
    goals: metric(
      record.goalsFor,
      record.goalsFor == null
        ? "Venue goals for are unpublished."
        : "Published venue goals for.",
    ),
    expectedGoals: metric(
      xg,
      xg == null
        ? "Venue xG is unpublished (season xG is not split home/away unless supplied)."
        : "Venue xG from the snapshot.",
    ),
    winRate: metric(
      wr,
      wr == null ? "Need played > 0 for win rate." : "Wins / played on this venue split.",
    ),
  };
}

export function homeLayer(input: TeamIntelligenceInput): VenueDnaLayer {
  return venueLayer(
    input.season.home,
    null,
    "No home venue split in team statistics.",
  );
}

export function awayLayer(input: TeamIntelligenceInput): VenueDnaLayer {
  return venueLayer(
    input.season.away,
    null,
    "No away venue split in team statistics.",
  );
}

export function momentumLayer(input: TeamIntelligenceInput): MomentumLayer {
  const letters = formLettersFrom(input.season.form, input.recent);
  const last5 = letters.slice(0, 5);
  const prior5 = letters.slice(5, 10);
  const q5 = formQuality(last5);
  const qPrior = formQuality(prior5);
  const current = q5 == null ? null : q5 * 100;
  let trend: MomentumLayer["trend"];
  let direction: MomentumLayer["performanceDirection"];
  if (q5 == null || qPrior == null) {
    trend = unavailable(
      "Need last 5 and previous 5 form letters to score a trend.",
    );
    direction = unavailable(
      "Need last 5 and previous 5 form letters for performance direction.",
    );
  } else {
    const delta = q5 - qPrior;
    const label =
      delta > 0.08 ? "improving" : delta < -0.08 ? "declining" : "stable";
    const dir = delta > 0.08 ? "up" : delta < -0.08 ? "down" : "flat";
    trend = metric(label, `Last-5 quality ${(q5 * 100).toFixed(0)} vs prior ${(qPrior * 100).toFixed(0)}.`);
    direction = metric(dir, "Signed last-5 minus previous-5 form quality.");
  }
  const sample = last5.length;
  const confidence =
    sample === 0
      ? null
      : clamp(40 + sample * 8, 40, 90);

  return {
    current: score(
      current,
      current == null ? "No recent form letters." : "Current momentum is last-5 form quality.",
    ),
    trend,
    confidence: score(
      confidence,
      confidence == null
        ? "No form sample for momentum confidence."
        : `Momentum confidence follows form sample size (${sample}).`,
    ),
    performanceDirection: direction,
  };
}

function matchesLastDays(
  input: TeamIntelligenceInput,
  days: number,
): number {
  const asOf = ms(input.asOf);
  if (asOf == null) return 0;
  const window = days * 86_400_000;
  return input.recent.filter((row) => {
    const kickoff = ms(row.kickoffAt);
    if (kickoff == null) return false;
    const delta = asOf - kickoff;
    return delta >= 0 && delta <= window;
  }).length;
}

export function healthLayer(input: TeamIntelligenceInput): SquadHealthLayer {
  const injuries = input.absences.injuries;
  const suspensions = input.absences.suspensions;
  const injuryCount = injuries.published ? injuries.items.length : null;
  const suspensionCount = suspensions.published ? suspensions.items.length : null;
  const listed = input.squad.listed;
  const available =
    listed == null || injuryCount == null || suspensionCount == null
      ? null
      : Math.max(0, listed - injuryCount - suspensionCount);

  const last14 = matchesLastDays(input, 14);
  const fatigue =
    input.recent.length === 0
      ? null
      : clamp(100 - last14 * 22, 20, 100);
  const bench = input.squad.bench;
  const starters = input.squad.starters;
  const depth =
    listed == null
      ? bench == null || starters == null
        ? null
        : clamp(((starters + bench) / 22) * 100, 20, 100)
      : clamp((listed / 25) * 100, 20, 100);
  const rotation =
    fatigue == null
      ? null
      : clamp(100 - fatigue + (bench == null ? 10 : Math.max(0, 12 - bench) * 4), 0, 100);
  const benchQuality =
    bench == null
      ? null
      : clamp((bench / 9) * 70, 15, 85);

  return {
    availablePlayers: metric(
      available,
      available == null
        ? "Available XI needs listed squad size plus a published absence feed."
        : "Listed squad minus published injuries and suspensions.",
    ),
    injuries: metric(
      injuryCount,
      injuries.published
        ? injuryCount === 0
          ? "No published absences. This is not a complete medical sheet."
          : `${injuryCount} published injur${injuryCount === 1 ? "y" : "ies"}.`
        : "Injury feed was not published on this snapshot.",
    ),
    suspensions: metric(
      suspensionCount,
      suspensions.published
        ? `${suspensionCount} published suspension${suspensionCount === 1 ? "" : "s"}.`
        : "Suspension feed was not published on this snapshot.",
    ),
    fatigue: score(
      fatigue,
      fatigue == null
        ? "Fatigue needs dated recent matches versus asOf."
        : `${last14} match${last14 === 1 ? "" : "es"} in the last 14 days.`,
    ),
    rotationRisk: score(
      rotation,
      rotation == null
        ? "Rotation risk needs fixture density (and bench size when listed)."
        : "Higher when recent density is high and the bench is thin.",
    ),
    benchQuality: score(
      benchQuality,
      benchQuality == null
        ? "Bench quality is not guessed from names. Needs a listed substitute count."
        : "Proxy from substitute count only — not player ratings.",
    ),
    squadDepth: score(
      depth,
      depth == null
        ? "Squad depth needs listed size or start XI + bench counts."
        : "Depth from published roster counts, not market values.",
    ),
  };
}

export function transferLayer(
  input: TeamIntelligenceInput,
): TransferIntelligenceLayer {
  const feed = input.transfers;
  if (!feed.published) {
    const note =
      "Transfer window facts are unpublished. The engine does not call /transfers or invent arrivals.";
    return {
      incomingTransfers: unavailable(note),
      outgoingTransfers: unavailable(note),
      estimatedImpact: unavailable(note),
      netSquadImprovement: unavailable(note),
      youthPromotions: unavailable(note),
      managerChanges: unavailable(note),
    };
  }

  const incoming = feed.incoming;
  const outgoing = feed.outgoing;
  const net =
    incoming == null || outgoing == null ? feed.estimatedImpact : incoming - outgoing;

  return {
    incomingTransfers: metric(
      incoming,
      incoming == null ? "Incoming count unpublished." : "Published incoming transfers.",
    ),
    outgoingTransfers: metric(
      outgoing,
      outgoing == null ? "Outgoing count unpublished." : "Published outgoing transfers.",
    ),
    estimatedImpact: metric(
      feed.estimatedImpact,
      feed.estimatedImpact == null
        ? "Impact is not inferred from names or fees."
        : "Catalogue-published impact delta.",
    ),
    netSquadImprovement: metric(
      net,
      net == null
        ? "Net improvement needs incoming and outgoing counts, or a published impact."
        : "Net = incoming − outgoing when both counts exist; else published impact.",
    ),
    youthPromotions: metric(
      feed.youthPromotions,
      feed.youthPromotions == null
        ? "Youth promotions unpublished."
        : "Published youth promotions.",
    ),
    managerChanges: metric(
      feed.managerChanged,
      feed.managerChanged == null
        ? "Manager change flag unpublished — not inferred from lineups."
        : feed.managerChanged
          ? "Catalogue marked a manager change."
          : "No published manager change.",
    ),
  };
}

export function parseStandingDescription(description: string | null): {
  titleRace: boolean | null;
  europe: boolean | null;
  relegation: boolean | null;
} {
  if (!description?.trim()) {
    return { titleRace: null, europe: null, relegation: null };
  }
  const text = description.toLowerCase();
  const europe = /champions league|europa league|conference league|\buefa\b/.test(
    text,
  );
  const relegation = /relegation/.test(text);
  const titleRace =
    !europe &&
    (/title winner|championship round|league winner/.test(text) ||
      (/\bchampion\b/.test(text) && !/champions league/.test(text)));
  return {
    titleRace: titleRace ? true : relegation ? false : null,
    europe: europe ? true : null,
    relegation: relegation ? true : null,
  };
}

export function motivationLayer(input: TeamIntelligenceInput): MotivationLayer {
  const rank = input.table.rank;
  const teams = input.table.teamsInTable;
  const flags = parseStandingDescription(input.table.description);
  let priority: TournamentPriority | null = null;
  if (flags.titleRace === true) priority = "title";
  else if (flags.europe === true) priority = "europe";
  else if (flags.relegation === true) priority = "relegation";
  else if (rank != null && teams != null && teams >= 8) priority = "league";
  else if (rank != null) priority = "mid_table";

  return {
    leaguePosition: metric(
      rank,
      rank == null
        ? "Table position unpublished."
        : teams != null
          ? `Rank ${rank} of ${teams}.`
          : `Rank ${rank}. Table size unpublished.`,
    ),
    titleRace: metric(
      flags.titleRace,
      flags.titleRace == null
        ? "Title-race flag only from vendor standing description — not from rumours."
        : "Parsed from the published standing description.",
    ),
    europeanQualification: metric(
      flags.europe,
      flags.europe == null
        ? "Europe flag only from vendor standing description."
        : "Parsed from the published standing description.",
    ),
    relegationRisk: metric(
      flags.relegation,
      flags.relegation == null
        ? "Relegation flag only from vendor standing description."
        : "Parsed from the published standing description.",
    ),
    derby: metric(
      input.schedule.nextIsDerby,
      input.schedule.nextIsDerby == null
        ? "Derby is not inferred from club names."
        : "Fixture catalogue marked the next match as a derby.",
    ),
    rivalry: metric(
      input.schedule.rivalry,
      input.schedule.rivalry == null
        ? "Rivalry is not inferred from club names."
        : "Fixture catalogue marked a rivalry.",
    ),
    tournamentPriority: metric(
      priority,
      priority == null
        ? "No table rank or standing description to set tournament priority."
        : "Priority from standing description when present, else league context from rank.",
    ),
  };
}

export function scheduleLayer(
  input: TeamIntelligenceInput,
  motivation: MotivationLayer,
): ScheduleLayer {
  const last = [...input.recent]
    .map((row) => ({ row, t: ms(row.kickoffAt) }))
    .filter((item): item is { row: RecentMatchFact; t: number } => item.t != null)
    .sort((a, b) => b.t - a.t)[0];
  const rest =
    last == null ? null : daysBetween(input.asOf, last.row.kickoffAt);
  const last14 = input.recent.length === 0 ? null : matchesLastDays(input, 14);
  const important =
    input.schedule.nextKickoffAt == null
      ? null
      : motivation.titleRace.value === true ||
          motivation.europeanQualification.value === true ||
          motivation.relegationRisk.value === true ||
          input.schedule.nextIsDerby === true;

  return {
    restDays: metric(
      rest == null ? null : round2(Math.max(0, rest)),
      rest == null
        ? "Rest days need a dated previous match and asOf."
        : "Days between asOf and the most recent dated result.",
    ),
    travelDistance: metric(
      input.schedule.travelKm,
      input.schedule.travelKm == null
        ? "Travel distance is unpublished. The engine does not geocode venues."
        : "Published travel kilometres.",
    ),
    matchesInLast14Days: metric(
      last14,
      last14 == null
        ? "Need dated recent matches to count the last 14 days."
        : "Finished matches with kickoff in the 14 days before asOf.",
    ),
    upcomingImportantMatch: metric(
      important,
      important == null
        ? "No next kickoff published."
        : "Important when the next match exists and standing description or derby is published.",
    ),
    fixtureCongestion: metric(
      last14 == null ? null : last14 >= 3,
      last14 == null
        ? "Congestion needs the last-14-day count."
        : last14 >= 3
          ? "Three or more matches in 14 days."
          : "Fewer than three matches in 14 days.",
    ),
  };
}

function isArtificialSurface(surface: string | null): boolean | null {
  if (!surface?.trim()) return null;
  return /artificial|turf|synthetic/.test(surface.toLowerCase());
}

export function environmentLayer(input: TeamIntelligenceInput): EnvironmentLayer {
  const turf = isArtificialSurface(input.identity.venueSurface);
  const note =
    "Experience scores need a multi-match sample on that condition. A single venue flag is stored, not extrapolated.";

  return {
    weatherSensitivity: unavailableScore(
      "Weather sensitivity is unpublished. A single match weather string is not a club coefficient.",
    ),
    weather: metric(
      input.environment.weather,
      input.environment.weather == null
        ? "No weather string on this snapshot."
        : "Published weather label (not a sensitivity model).",
    ),
    altitudeExperience: unavailableScore(note),
    altitudeMeters: metric(
      input.environment.altitudeMeters,
      input.environment.altitudeMeters == null
        ? "Altitude unpublished."
        : "Published altitude in metres.",
    ),
    artificialTurfExperience: unavailableScore(note),
    artificialTurf: metric(
      turf,
      turf == null
        ? "Venue surface unpublished."
        : turf
          ? "Venue surface reads as artificial turf."
          : "Venue surface is not tagged artificial.",
    ),
    refereeCompatibility: unavailableScore(
      "Referee compatibility needs a club–official history. A name on one fixture is not a rating.",
    ),
    refereeName: metric(
      input.environment.refereeName,
      input.environment.refereeName == null
        ? "No referee on this snapshot."
        : "Published referee name.",
    ),
  };
}

/**
 * PE-4I.4 — Candidate canonical performance fields (no model / no composite score).
 */

export const PE4I4_XG_STATUS =
  "OBSERVED_IN_CONTROLLED_PROVIDER_SAMPLE" as const;

export type Pe4I4CanonicalPerformanceField =
  | "goals_for"
  | "goals_against"
  | "expected_goals_for"
  | "expected_goals_against"
  | "total_shots_for"
  | "total_shots_against"
  | "shots_on_target_for"
  | "shots_on_target_against"
  | "possession_for"
  | "possession_against"
  | "corners_for"
  | "corners_against"
  | "yellow_cards_for"
  | "yellow_cards_against"
  | "red_cards_for"
  | "red_cards_against";

export const PE4I4_CANONICAL_PERFORMANCE_FIELDS: readonly Pe4I4CanonicalPerformanceField[] =
  [
    "goals_for",
    "goals_against",
    "expected_goals_for",
    "expected_goals_against",
    "total_shots_for",
    "total_shots_against",
    "shots_on_target_for",
    "shots_on_target_against",
    "possession_for",
    "possession_against",
    "corners_for",
    "corners_against",
    "yellow_cards_for",
    "yellow_cards_against",
    "red_cards_for",
    "red_cards_against",
  ] as const;

/** Raw provider statistic names that map to team-side canonical fields. */
export const PE4I4_STAT_RAW_NAME_CANDIDATES: Readonly<
  Record<
    Exclude<
      Pe4I4CanonicalPerformanceField,
      "goals_for" | "goals_against"
    >,
    readonly string[]
  >
> = {
  expected_goals_for: ["expected_goals", "expected goals", "xg"],
  expected_goals_against: ["expected_goals", "expected goals", "xg"],
  total_shots_for: ["total shots", "shots"],
  total_shots_against: ["total shots", "shots"],
  shots_on_target_for: ["shots on goal", "shots on target"],
  shots_on_target_against: ["shots on goal", "shots on target"],
  possession_for: ["ball possession", "possession"],
  possession_against: ["ball possession", "possession"],
  corners_for: ["corner kicks", "corners"],
  corners_against: ["corner kicks", "corners"],
  yellow_cards_for: ["yellow cards"],
  yellow_cards_against: ["yellow cards"],
  red_cards_for: ["red cards"],
  red_cards_against: ["red cards"],
};

export type Pe4I4FieldObservation = {
  canonical: Pe4I4CanonicalPerformanceField;
  rawName: string | null;
  rawValue: string | number | null;
  valuePresence: "present" | "missing";
  parsedNumeric: number | null;
  /** Never true: EloPoisson λ must not fill missing provider xG. */
  eloPoissonSubstitutionUsed: false;
};

export function mapRawStatToCanonicalSide(input: {
  rawName: string;
  rawValue: string | number | null;
  valuePresence: "present" | "missing";
  parsedNumeric: number | null;
  side: "for" | "against";
}): Pe4I4FieldObservation | null {
  const lower = input.rawName.toLowerCase();
  const pairs: Array<{
    forField: Pe4I4CanonicalPerformanceField;
    againstField: Pe4I4CanonicalPerformanceField;
    names: readonly string[];
  }> = [
    {
      forField: "expected_goals_for",
      againstField: "expected_goals_against",
      names: PE4I4_STAT_RAW_NAME_CANDIDATES.expected_goals_for,
    },
    {
      forField: "total_shots_for",
      againstField: "total_shots_against",
      names: PE4I4_STAT_RAW_NAME_CANDIDATES.total_shots_for,
    },
    {
      forField: "shots_on_target_for",
      againstField: "shots_on_target_against",
      names: PE4I4_STAT_RAW_NAME_CANDIDATES.shots_on_target_for,
    },
    {
      forField: "possession_for",
      againstField: "possession_against",
      names: PE4I4_STAT_RAW_NAME_CANDIDATES.possession_for,
    },
    {
      forField: "corners_for",
      againstField: "corners_against",
      names: PE4I4_STAT_RAW_NAME_CANDIDATES.corners_for,
    },
    {
      forField: "yellow_cards_for",
      againstField: "yellow_cards_against",
      names: PE4I4_STAT_RAW_NAME_CANDIDATES.yellow_cards_for,
    },
    {
      forField: "red_cards_for",
      againstField: "red_cards_against",
      names: PE4I4_STAT_RAW_NAME_CANDIDATES.red_cards_for,
    },
  ];
  for (const p of pairs) {
    if (!p.names.some((n) => n.toLowerCase() === lower)) continue;
    return {
      canonical: input.side === "for" ? p.forField : p.againstField,
      rawName: input.rawName,
      rawValue: input.rawValue,
      valuePresence: input.valuePresence,
      parsedNumeric:
        input.valuePresence === "present" ? input.parsedNumeric : null,
      eloPoissonSubstitutionUsed: false,
    };
  }
  return null;
}

/**
 * Missing provider xG must stay missing — never substitute EloPoisson expectedGoals.
 */
export function refuseEloPoissonXgSubstitution(): {
  allowed: false;
  reason: string;
} {
  return {
    allowed: false,
    reason:
      "provider expected_goals missing must remain missing; EloPoisson expectedGoals is not vendor xG",
  };
}

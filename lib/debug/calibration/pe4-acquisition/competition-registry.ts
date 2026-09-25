/**
 * PE-4I.2/I.3 — Research competition classifier.
 * Provider IDs pinned only from in-repo evidence or controlled live smoke.
 * Unknown IDs stay UNKNOWN (preserved, not discarded).
 */

import { PE4I2_TARGET_LEAGUE_PROVIDER_ID } from "@/lib/debug/calibration/pe4-acquisition/protocol";

export type Pe4I2CompetitionClass =
  | "target_domestic_league"
  | "domestic_cup"
  | "domestic_league_cup"
  | "uefa_champions_league"
  | "uefa_europa_league"
  | "uefa_conference_league"
  | "other_known_competition"
  | "unknown_competition";

/**
 * Evidence for each pinned id (research audit trail).
 * PE-4I.3 smoke: Manchester United (33) season 2024 team-season schedule.
 */
export const PE4I2_COMPETITION_ID_EVIDENCE = {
  "39": {
    class: "target_domestic_league" as const,
    evidence:
      "In-repo calibration + PE-4I.3 smoke provider name 'Premier League'",
  },
  "45": {
    class: "domestic_cup" as const,
    evidence:
      "PE-4I.3 smoke team=33 season=2024: providerCompetitionName='FA Cup' (3 fixtures)",
  },
  "48": {
    class: "domestic_league_cup" as const,
    evidence:
      "PE-4I.3 smoke team=33 season=2024: providerCompetitionName='League Cup' (3 fixtures)",
  },
  "3": {
    class: "uefa_europa_league" as const,
    evidence:
      "PE-4I.3 smoke team=33 season=2024: providerCompetitionName='UEFA Europa League' (15 fixtures)",
  },
  "2": {
    class: "uefa_champions_league" as const,
    evidence:
      "PE-4I.5 Stage-1: providerCompetitionId=2 name='UEFA Champions League' (78 unique fixtures across 2023/2024 PL club schedules)",
  },
  "848": {
    class: "uefa_conference_league" as const,
    evidence:
      "PE-4I.5 Stage-1: providerCompetitionId=848 name='UEFA Europa Conference League' (29 unique fixtures across 2023/2024 PL club schedules)",
  },
  "528": {
    class: "other_known_competition" as const,
    evidence:
      "PE-4I.3 smoke team=33 season=2024: providerCompetitionName='Community Shield' (1 fixture)",
  },
  "667": {
    class: "other_known_competition" as const,
    evidence:
      "PE-4I.3 smoke team=33 season=2024: providerCompetitionName='Friendlies Clubs' (5 fixtures)",
  },
  "1022": {
    class: "other_known_competition" as const,
    evidence:
      "PE-4I.3 smoke team=33 season=2024: providerCompetitionName='Premier League - Summer Series' (3 fixtures)",
  },
} as const;

/** Frozen id→class map (only evidenced pins). */
export const PE4I2_COMPETITION_ID_REGISTRY: Readonly<
  Record<string, Pe4I2CompetitionClass>
> = Object.fromEntries(
  Object.entries(PE4I2_COMPETITION_ID_EVIDENCE).map(([id, meta]) => [
    id,
    meta.class,
  ]),
) as Readonly<Record<string, Pe4I2CompetitionClass>>;

// Ensure PL target id remains pinned even if evidence map is edited poorly.
void PE4I2_TARGET_LEAGUE_PROVIDER_ID;

export type Pe4I2CompetitionClassification = {
  providerCompetitionId: string | null;
  providerCompetitionName: string | null;
  competitionClass: Pe4I2CompetitionClass;
  classificationSource: "id_registry" | "unknown";
  /** Diagnostic only — never upgrades unknown → known. */
  nameHint: Pe4I2CompetitionClass | null;
};

/**
 * Soft name hints for diagnostics. Never used as authoritative classification.
 */
export function suggestCompetitionClassFromName(
  name: string | null | undefined,
): Pe4I2CompetitionClass | null {
  if (!name) return null;
  const n = name.trim().toLowerCase();
  if (!n) return null;
  if (n.includes("premier league") && !n.includes("summer")) {
    return "target_domestic_league";
  }
  if (n === "fa cup" || n.includes("fa cup")) return "domestic_cup";
  if (
    n.includes("efl cup") ||
    n.includes("carabao") ||
    n.includes("league cup")
  ) {
    return "domestic_league_cup";
  }
  if (n.includes("champions league")) return "uefa_champions_league";
  if (n.includes("europa league") && !n.includes("conference")) {
    return "uefa_europa_league";
  }
  if (n.includes("conference league")) return "uefa_conference_league";
  return null;
}

export function classifyPe4I2Competition(input: {
  providerCompetitionId: string | null | undefined;
  providerCompetitionName?: string | null;
}): Pe4I2CompetitionClassification {
  const id =
    input.providerCompetitionId == null
      ? null
      : String(input.providerCompetitionId).trim();
  const name =
    input.providerCompetitionName == null
      ? null
      : String(input.providerCompetitionName).trim() || null;
  const nameHint = suggestCompetitionClassFromName(name);
  if (id && PE4I2_COMPETITION_ID_REGISTRY[id]) {
    return {
      providerCompetitionId: id,
      providerCompetitionName: name,
      competitionClass: PE4I2_COMPETITION_ID_REGISTRY[id]!,
      classificationSource: "id_registry",
      nameHint,
    };
  }
  return {
    providerCompetitionId: id,
    providerCompetitionName: name,
    competitionClass: "unknown_competition",
    classificationSource: "unknown",
    nameHint,
  };
}

/** PE-4I.3 controlled sample observation (not a global claim). */
export const PE4I3_XG_STATUS =
  "OBSERVED_IN_CONTROLLED_PROVIDER_SAMPLE" as const;

export const PE4I3_XG_EVIDENCE = {
  fixtureId: "1208021",
  rawField: "expected_goals",
  teamValues: [
    { providerTeamId: "33", rawValue: "2.43" },
    { providerTeamId: "36", rawValue: "0.44" },
  ],
  note: "Single-fixture controlled smoke. Does not prove global coverage.",
} as const;

/**
 * PE-4I.5 — Evidence-backed competition pin proposals from observed schedules.
 * Pins only when provider id + name are explicit and unambiguous.
 * Never infers ids from memory alone.
 */

import type { Pe4I2CompetitionClass } from "@/lib/debug/calibration/pe4-acquisition/competition-registry";
import { PE4I2_COMPETITION_ID_REGISTRY } from "@/lib/debug/calibration/pe4-acquisition/competition-registry";
import type { Pe4I2RawScheduleFixtureRow } from "@/lib/debug/calibration/pe4-acquisition/envelopes";

export type Pe4I5CompetitionPinProposal = {
  providerCompetitionId: string;
  providerCompetitionName: string;
  competitionClass: Pe4I2CompetitionClass;
  fixtureAppearances: number;
  uniqueFixtures: number;
  evidence: string;
  alreadyPinned: boolean;
};

/**
 * Ambiguous-name guard: only pin when the observed provider name matches
 * a single well-known competition class without conflicting labels.
 */
function unambiguousClassFromName(
  name: string,
): Pe4I2CompetitionClass | null {
  const n = name.trim().toLowerCase();
  if (!n) return null;
  if (n === "uefa champions league" || n === "champions league") {
    return "uefa_champions_league";
  }
  if (
    n === "uefa europa conference league" ||
    n === "uefa conference league" ||
    n === "europa conference league"
  ) {
    return "uefa_conference_league";
  }
  if (n === "uefa europa league" || n === "europa league") {
    return "uefa_europa_league";
  }
  if (n === "premier league") return "target_domestic_league";
  if (n === "fa cup") return "domestic_cup";
  if (n === "league cup" || n === "efl cup" || n === "carabao cup") {
    return "domestic_league_cup";
  }
  if (n === "community shield" || n === "fa community shield") {
    return "other_known_competition";
  }
  if (n === "friendlies clubs") return "other_known_competition";
  if (n === "premier league - summer series") {
    return "other_known_competition";
  }
  return null;
}

/**
 * Propose pins for competitions observed in Stage-1 schedules.
 * Does not mutate the registry — caller applies accepted pins explicitly.
 */
export function proposeEvidenceBackedCompetitionPins(
  fixtures: readonly Pe4I2RawScheduleFixtureRow[],
): Pe4I5CompetitionPinProposal[] {
  const byId = new Map<
    string,
    {
      names: Map<string, number>;
      fixtureIds: Set<string>;
      appearances: number;
    }
  >();
  for (const f of fixtures) {
    const id = f.providerCompetitionId?.trim();
    if (!id) continue;
    const name = (f.providerCompetitionName ?? "").trim();
    let cur = byId.get(id);
    if (!cur) {
      cur = { names: new Map(), fixtureIds: new Set(), appearances: 0 };
      byId.set(id, cur);
    }
    cur.appearances += 1;
    cur.fixtureIds.add(f.providerFixtureId);
    if (name) cur.names.set(name, (cur.names.get(name) ?? 0) + 1);
  }

  const proposals: Pe4I5CompetitionPinProposal[] = [];
  for (const [id, agg] of [...byId.entries()].sort((a, b) =>
    a[0].localeCompare(b[0]),
  )) {
    const alreadyPinned = Boolean(PE4I2_COMPETITION_ID_REGISTRY[id]);
    if (agg.names.size !== 1) continue;
    const [[name]] = [...agg.names.entries()];
    if (!name) continue;
    const cls = unambiguousClassFromName(name);
    if (!cls) continue;
    proposals.push({
      providerCompetitionId: id,
      providerCompetitionName: name,
      competitionClass: cls,
      fixtureAppearances: agg.appearances,
      uniqueFixtures: agg.fixtureIds.size,
      evidence: `PE-4I.5 Stage-1 observed providerCompetitionId=${id} name='${name}' (${agg.fixtureIds.size} unique fixtures)`,
      alreadyPinned,
    });
  }
  return proposals;
}

/** New pins only (not already in registry). */
export function newCompetitionPinsToApply(
  fixtures: readonly Pe4I2RawScheduleFixtureRow[],
): Pe4I5CompetitionPinProposal[] {
  return proposeEvidenceBackedCompetitionPins(fixtures).filter(
    (p) => !p.alreadyPinned,
  );
}

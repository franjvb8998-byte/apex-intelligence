/**
 * Key-reason cards. A reason is emitted only when the catalogue supports it.
 */

import type { ReportFacts } from "@/lib/intelligence-report/facts";
import type { ApexReportReason } from "@/lib/intelligence-report/types";
import type { MatchAnalysisData } from "@/lib/match-analysis/types";

function fmt(value: number, digits = 2): string {
  return value.toFixed(digits);
}

function concededPerMatch(side: ReportFacts["pick"]): number | null {
  if (side.goalsAgainst == null || side.played == null || side.played <= 0) {
    return null;
  }
  return side.goalsAgainst / side.played;
}

export function buildReportReasons(
  facts: ReportFacts,
  data: Omit<MatchAnalysisData, "report" | "decision">,
): ApexReportReason[] {
  const reasons: ApexReportReason[] = [];
  const xgGap = facts.pickXg - facts.otherXg;

  if (facts.predicted !== "draw" && xgGap >= 0.25 && facts.pickXg >= 1.2) {
    reasons.push({
      id: "attacking_efficiency",
      title: "Better attacking efficiency",
      detail: `${facts.pickName} projects ${fmt(facts.pickXg)} xG versus ${fmt(facts.otherXg)} for ${facts.otherName}.`,
    });
  }

  const pickConceded = concededPerMatch(facts.pick);
  const otherConceded = concededPerMatch(facts.other);
  if (
    facts.predicted !== "draw" &&
    pickConceded != null &&
    otherConceded != null &&
    otherConceded - pickConceded >= 0.2
  ) {
    reasons.push({
      id: "defensive_record",
      title: "Better defensive record",
      detail: `${facts.pickName} concedes ${fmt(pickConceded, 2)} goals per match versus ${fmt(otherConceded, 2)} for ${facts.otherName}.`,
    });
  } else if (
    facts.predicted !== "draw" &&
    facts.otherXg <= 1.15 &&
    xgGap >= 0.25
  ) {
    reasons.push({
      id: "defensive_record",
      title: "Better defensive record",
      detail: `${facts.otherName} is held to ${fmt(facts.otherXg)} xG, below ${facts.pickName}'s ${fmt(facts.pickXg)} projected output.`,
    });
  }

  if (facts.predicted === "home" && facts.xgDiff >= 0.25) {
    reasons.push({
      id: "xg_differential",
      title: "Positive xG differential",
      detail: `Model xG gap is +${fmt(facts.xgDiff)} in favour of ${facts.homeName}.`,
    });
  } else if (facts.predicted === "away" && facts.xgDiff <= -0.25) {
    reasons.push({
      id: "xg_differential",
      title: "Positive xG differential",
      detail: `Model xG gap is ${fmt(facts.xgDiff)} — ${facts.awayName} is the stronger attack in this fixture.`,
    });
  }

  if (
    facts.pick.formQuality != null &&
    facts.other.formQuality != null &&
    facts.pick.formQuality - facts.other.formQuality >= 0.12
  ) {
    reasons.push({
      id: "recent_form",
      title: "Better recent form",
      detail: `${facts.pickName} form quality ${(facts.pick.formQuality * 100).toFixed(0)} vs ${(facts.other.formQuality * 100).toFixed(0)} for ${facts.otherName}.`,
    });
  }

  const homeEdge = data.oneXTwo.home - data.oneXTwo.away;
  if (facts.predicted === "home" && homeEdge >= 0.08) {
    reasons.push({
      id: "home_advantage",
      title: "Home advantage",
      detail: `${facts.homeName} is priced by the model ${(homeEdge * 100).toFixed(0)} points above ${facts.awayName} on the 1X2 board.`,
    });
  }

  if (facts.other.injuryCount >= 1) {
    reasons.push({
      id: "opponent_absences",
      title: "Opponent missing starters",
      detail: `${facts.otherName} has ${facts.other.injuryCount} published absence${facts.other.injuryCount === 1 ? "" : "s"} in the injury feed.`,
    });
  }

  if (
    facts.pick.restDays != null &&
    facts.other.restDays != null &&
    facts.pick.restDays - facts.other.restDays >= 2
  ) {
    reasons.push({
      id: "better_rest",
      title: "Better rest",
      detail: `${facts.pickName} has ${fmt(facts.pick.restDays, 1)} days since the last listed match versus ${fmt(facts.other.restDays, 1)} for ${facts.otherName}.`,
    });
  }

  const h2h = facts.h2h;
  if (h2h && h2h.meetings >= 2) {
    if (facts.predicted === "draw" && h2h.draws > h2h.meetings / 2) {
      reasons.push({
        id: "better_h2h",
        title: "Better H2H",
        detail: `${h2h.draws} of ${h2h.meetings} published meetings ended level.`,
      });
    } else if (facts.predicted !== "draw" && h2h.pickWins > h2h.otherWins) {
      reasons.push({
        id: "better_h2h",
        title: "Better H2H",
        detail: `${facts.pickName} leads the published H2H ${h2h.pickWins}–${h2h.otherWins} (${h2h.draws} draws) across ${h2h.meetings} meetings.`,
      });
    }
  }

  return reasons;
}

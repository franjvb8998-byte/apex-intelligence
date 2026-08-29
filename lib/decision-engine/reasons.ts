/**
 * Reasons to bet (3–6 strongest) and mandatory reasons not to bet.
 * Never invents derby, rotation, cup or new-coach flags.
 */

import type {
  ApexDecisionInput,
  ApexDecisionReason,
  ApexRiskBlock,
  ApexScoreComponent,
  ApexValueBlock,
} from "@/lib/decision-engine/types";

function pick(input: ApexDecisionInput) {
  return input.predicted === "away" ? input.away : input.home;
}

function other(input: ApexDecisionInput) {
  return input.predicted === "away" ? input.home : input.away;
}

export function reasonsToBet(input: {
  data: ApexDecisionInput;
  components: ApexScoreComponent[];
  value: ApexValueBlock;
}): ApexDecisionReason[] {
  const { data, components, value } = input;
  const candidates: Array<ApexDecisionReason & { rank: number }> = [];
  const attack = components.find((c) => c.key === "attack");
  const defense = components.find((c) => c.key === "defense");
  const form = components.find((c) => c.key === "form");
  const xg = components.find((c) => c.key === "xg");
  const hfa = components.find((c) => c.key === "homeAdvantage");
  const rest = components.find((c) => c.key === "rest");

  if (attack?.available && (attack.score ?? 0) >= 58) {
    candidates.push({
      id: "attack",
      title: "Better attack",
      detail: attack.note,
      rank: attack.score ?? 0,
    });
  }
  if (defense?.available && (defense.score ?? 0) >= 55) {
    candidates.push({
      id: "defense",
      title: "Better defense",
      detail: defense.note,
      rank: defense.score ?? 0,
    });
  }
  if (xg?.available && Math.abs(data.expectedGoals.home - data.expectedGoals.away) >= 0.25) {
    candidates.push({
      id: "xg",
      title: "Positive xG",
      detail: xg.note,
      rank: xg.score ?? 0,
    });
  }
  if (form?.available && pick(data).formQuality != null && other(data).formQuality != null) {
    const gap = (pick(data).formQuality ?? 0) - (other(data).formQuality ?? 0);
    if (gap >= 0.1) {
      candidates.push({
        id: "form",
        title: "Stronger recent form",
        detail: form.note,
        rank: 70 + gap * 40,
      });
    }
  }
  if (data.predicted === "home" && hfa?.available && (hfa.score ?? 0) >= 55) {
    candidates.push({
      id: "hfa",
      title: "Home advantage",
      detail: hfa.note,
      rank: hfa.score ?? 0,
    });
  }
  if (value.positiveEdge) {
    candidates.push({
      id: "value",
      title: "Market value",
      detail: `Model probability sits above the implied board (edge ${((value.marketEdge ?? value.expectedValue ?? 0) * 100).toFixed(1)} pp).`,
      rank: 80 + (value.expectedValue ?? 0) * 40,
    });
  }
  if (
    rest?.available &&
    pick(data).restDays != null &&
    other(data).restDays != null &&
    (pick(data).restDays ?? 0) - (other(data).restDays ?? 0) >= 2
  ) {
    candidates.push({
      id: "rest",
      title: "Better rest",
      detail: rest.note,
      rank: rest.score ?? 0,
    });
  }
  if (other(data).injuryCount >= 1) {
    candidates.push({
      id: "opp_inj",
      title: "Opponent absences",
      detail: `${other(data).name} has ${other(data).injuryCount} published absence(s).`,
      rank: 60 + other(data).injuryCount * 8,
    });
  }
  if (
    data.h2h &&
    data.h2h.meetings >= 2 &&
    data.predicted !== "draw" &&
    data.h2h.pickWins > data.h2h.otherWins
  ) {
    candidates.push({
      id: "h2h",
      title: "Better H2H",
      detail: `${pick(data).name} leads the published H2H ${data.h2h.pickWins}–${data.h2h.otherWins} across ${data.h2h.meetings} meetings.`,
      rank: 58,
    });
  }

  return candidates
    .sort((a, b) => b.rank - a.rank)
    .slice(0, 6)
    .map(({ id, title, detail }) => ({ id, title, detail }));
}

export function reasonsNotToBet(input: {
  data: ApexDecisionInput;
  risk: ApexRiskBlock;
  value: ApexValueBlock;
  coverage: number;
}): ApexDecisionReason[] {
  const { data, risk, value, coverage } = input;
  const out: ApexDecisionReason[] = [];
  const seen = new Set<string>();

  for (const row of risk.reasons) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    out.push(row);
  }

  if (value.negativeEdge) {
    out.push({
      id: "neg_edge",
      title: "Negative edge",
      detail: "The published price does not beat the model probability.",
    });
  }

  if (coverage < 0.45 && !seen.has("missing_data")) {
    out.push({
      id: "sample",
      title: "Small statistical sample",
      detail: "Too many Decision Engine pillars are unpublished to size a full stake.",
    });
  }

  if (pick(data).injuryCount >= 1 && !seen.has("injuries")) {
    out.push({
      id: "injuries",
      title: "Injuries",
      detail: `${pick(data).name} has published absences.`,
    });
  }

  if (out.length === 0) {
    out.push({
      id: "residual",
      title: "Residual uncertainty",
      detail: "Football outcomes stay noisy even when the published board is clean.",
    });
  }

  return out.slice(0, 6);
}

/**
 * Team Intelligence Engine — evaluate a club snapshot into a digital twin.
 */

import {
  awayLayer,
  environmentLayer,
  formLayer,
  healthLayer,
  homeLayer,
  identityLayer,
  momentumLayer,
  motivationLayer,
  scheduleLayer,
  tacticalLayer,
  transferLayer,
} from "@/lib/team-intelligence/calculators";
import { mean } from "@/lib/team-intelligence/normalizers";
import type { TeamIntelligence } from "@/lib/team-intelligence/models";
import { buildTeamIntelligenceScores } from "@/lib/team-intelligence/scores";
import type { TeamIntelligenceInput } from "@/lib/team-intelligence/types";

export type TeamIntelligenceEnginePort = {
  readonly id: "team-intelligence-v1";
  evaluate(input: TeamIntelligenceInput): TeamIntelligence;
};

function reasonsFrom(twin: Omit<TeamIntelligence, "reasons">): string[] {
  const lines: string[] = [];
  if (twin.identity.playingStyle) {
    lines.push(`Published identity reads as ${twin.identity.playingStyle.replaceAll("_", " ")}.`);
  }
  if (twin.form.last5Quality.available && twin.form.last5.length > 0) {
    lines.push(`Last 5: ${twin.form.last5.join("")}.`);
  }
  if (twin.motivation.leaguePosition.available) {
    lines.push(`Table rank ${twin.motivation.leaguePosition.value}.`);
  }
  if (twin.health.injuries.available && (twin.health.injuries.value ?? 0) > 0) {
    lines.push(`${twin.health.injuries.value} published injur${twin.health.injuries.value === 1 ? "y" : "ies"}.`);
  }
  if (twin.scores.coverage < 0.4) {
    lines.push(
      "Coverage is thin — several layers stayed n/d because the catalogue was silent.",
    );
  }
  if (lines.length === 0) {
    lines.push("Twin assembled from published identity only; scoring layers were unavailable.");
  }
  return lines.slice(0, 6);
}

export function evaluateTeamIntelligence(
  input: TeamIntelligenceInput,
): TeamIntelligence {
  const possessionPct = mean(input.recent.map((row) => row.possession));
  const identity = identityLayer(input, possessionPct);
  const tactical = tacticalLayer(input);
  const form = formLayer(input);
  const home = homeLayer(input);
  const away = awayLayer(input);
  const momentum = momentumLayer(input);
  const health = healthLayer(input);
  const transfers = transferLayer(input);
  const motivation = motivationLayer(input);
  const schedule = scheduleLayer(input, motivation);
  const environment = environmentLayer(input);
  const scores = buildTeamIntelligenceScores({
    input,
    tactical,
    form,
    home,
    away,
    momentum,
    health,
    transfers,
    motivation,
  });

  const twin: Omit<TeamIntelligence, "reasons"> = {
    engineId: "team-intelligence-v1",
    teamId: input.identity.teamId,
    asOf: input.asOf,
    identity,
    tactical,
    form,
    home,
    away,
    momentum,
    health,
    transfers,
    motivation,
    schedule,
    environment,
    scores,
  };

  return { ...twin, reasons: reasonsFrom(twin) };
}

export function createTeamIntelligenceEngine(): TeamIntelligenceEnginePort {
  return {
    id: "team-intelligence-v1",
    evaluate: evaluateTeamIntelligence,
  };
}

export function evaluateMatchClubTwins(
  home: TeamIntelligenceInput,
  away: TeamIntelligenceInput,
): { home: TeamIntelligence; away: TeamIntelligence } {
  return {
    home: evaluateTeamIntelligence(home),
    away: evaluateTeamIntelligence(away),
  };
}

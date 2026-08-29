/**
 * Team Intelligence Score — coverage-weighted blend of published pillars.
 * Does not reuse Decision Engine weights and does not price a match.
 */

import type {
  CurrentFormLayer,
  MotivationLayer,
  MomentumLayer,
  SquadHealthLayer,
  TacticalDnaLayer,
  TeamIntelligencePillar,
  TeamIntelligenceScores,
  TransferIntelligenceLayer,
  VenueDnaLayer,
} from "@/lib/team-intelligence/models";
import { clamp, coverageBlend, roundScore, score } from "@/lib/team-intelligence/normalizers";
import type { TeamIntelligenceInput } from "@/lib/team-intelligence/types";
import {
  TEAM_INTELLIGENCE_PILLAR_LABELS,
  TEAM_INTELLIGENCE_WEIGHTS,
} from "@/lib/team-intelligence/weights";

function motivationScore(
  input: TeamIntelligenceInput,
  layer: MotivationLayer,
): number | null {
  const rank = input.table.rank;
  const teams = input.table.teamsInTable;
  if (rank == null) return null;
  const percentile =
    teams != null && teams > 1
      ? clamp((1 - (rank - 1) / (teams - 1)) * 100, 5, 100)
      : clamp(100 - (rank - 1) * 4, 8, 100);
  let bump = 0;
  if (layer.titleRace.value === true) bump += 8;
  if (layer.europeanQualification.value === true) bump += 5;
  if (layer.relegationRisk.value === true) bump += 10;
  if (layer.derby.value === true) bump += 4;
  return clamp(percentile + bump, 5, 100);
}

function transferStabilityScore(layer: TransferIntelligenceLayer): number | null {
  if (
    !layer.incomingTransfers.available &&
    !layer.outgoingTransfers.available &&
    !layer.managerChanges.available
  ) {
    return null;
  }
  const outgoing = layer.outgoingTransfers.value ?? 0;
  const incoming = layer.incomingTransfers.value ?? 0;
  const churn = outgoing + incoming;
  const managerPenalty = layer.managerChanges.value === true ? 18 : 0;
  return clamp(82 - churn * 6 - managerPenalty, 15, 95);
}

function healthScore(layer: SquadHealthLayer): number | null {
  const parts: Array<{ score: number | null; weight: number }> = [
    {
      score:
        layer.injuries.value == null
          ? null
          : clamp(100 - layer.injuries.value * 18, 10, 100),
      weight: 0.35,
    },
    {
      score:
        layer.suspensions.value == null
          ? null
          : clamp(100 - layer.suspensions.value * 14, 20, 100),
      weight: 0.15,
    },
    { score: layer.fatigue.value, weight: 0.25 },
    { score: layer.squadDepth.value, weight: 0.25 },
  ];
  const blend = coverageBlend(parts);
  return blend.coverage === 0 ? null : blend.score;
}

function tacticalIdentityScore(layer: TacticalDnaLayer): number | null {
  const blend = coverageBlend([
    { score: layer.attackingStrength.value, weight: 0.3 },
    { score: layer.defensiveStrength.value, weight: 0.3 },
    { score: layer.possessionStyle.value, weight: 0.2 },
    { score: layer.pressingIntensity.value, weight: 0.1 },
    { score: layer.tempo.value, weight: 0.05 },
    { score: layer.width.value, weight: 0.05 },
  ]);
  return blend.coverage === 0 ? null : blend.score;
}

export function buildTeamIntelligenceScores(args: {
  input: TeamIntelligenceInput;
  tactical: TacticalDnaLayer;
  form: CurrentFormLayer;
  home: VenueDnaLayer;
  away: VenueDnaLayer;
  momentum: MomentumLayer;
  health: SquadHealthLayer;
  transfers: TransferIntelligenceLayer;
  motivation: MotivationLayer;
}): TeamIntelligenceScores {
  const attack = score(
    args.tactical.attackingStrength.value,
    args.tactical.attackingStrength.note,
  );
  const defense = score(
    args.tactical.defensiveStrength.value,
    args.tactical.defensiveStrength.note,
  );
  const momentum = score(
    args.momentum.current.value,
    args.momentum.current.note,
  );
  const health = score(
    healthScore(args.health),
    args.health.injuries.available
      ? "Health blends published absences, fatigue and depth."
      : "Health needs a published absence feed or roster counts.",
  );
  const tacticalIdentity = score(
    tacticalIdentityScore(args.tactical),
    "Tactical identity blends published attack, defense and style axes.",
  );
  const motivation = score(
    motivationScore(args.input, args.motivation),
    args.input.table.rank == null
      ? "Motivation is not inferred from rumours or cups without a table rank."
      : "Motivation from table rank, plus standing-description flags when present.",
  );
  const transferStability = score(
    transferStabilityScore(args.transfers),
    args.transfers.incomingTransfers.available ||
      args.transfers.outgoingTransfers.available
      ? "Stability is high when published churn is low."
      : "Transfer stability is unpublished without a transfer feed.",
  );
  const home = score(args.home.strength.value, args.home.strength.note);
  const away = score(args.away.strength.value, args.away.strength.note);

  const pillars: TeamIntelligencePillar[] = (
    Object.keys(TEAM_INTELLIGENCE_WEIGHTS) as Array<
      keyof typeof TEAM_INTELLIGENCE_WEIGHTS
    >
  ).map((key) => {
    const block = {
      attack,
      defense,
      momentum,
      health,
      tacticalIdentity,
      motivation,
      transferStability,
      home,
      away,
    }[key];
    return {
      key,
      label: TEAM_INTELLIGENCE_PILLAR_LABELS[key],
      weight: TEAM_INTELLIGENCE_WEIGHTS[key],
      score: block.value,
      available: block.available,
      note: block.note,
    };
  });

  const blend = coverageBlend(
    pillars.map((pillar) => ({ score: pillar.score, weight: pillar.weight })),
  );

  return {
    overall: roundScore(blend.score),
    coverage: Math.round(blend.coverage * 1000) / 1000,
    attack,
    defense,
    momentum,
    health,
    tacticalIdentity,
    motivation,
    transferStability,
    home,
    away,
    pillars,
  };
}

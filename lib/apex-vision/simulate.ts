import type {
  PitchPoint,
  VisionEventType,
  VisionLiveEvent,
  VisionLiveState,
  VisionRiskLevel,
  VisionSide,
} from "@/lib/apex-vision/types";
import {
  buildProbabilityImpact,
  buildTimelineIntelligence,
} from "@/lib/apex-vision/timeline-intelligence";

const EVENT_TYPES: VisionEventType[] = [
  "pase",
  "disparo",
  "falta",
  "tarjeta",
  "corner",
  "cambio",
  "ataque_peligroso",
];

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function clamp01(value: number): number {
  return clamp(value, 0, 1);
}

function jitter(value: number, amount: number): number {
  return value + (Math.random() * 2 - 1) * amount;
}

function pickSide(momentum: number): VisionSide {
  if (Math.random() < 0.55 + momentum / 400) return "home";
  return "away";
}

function eventCopy(
  type: VisionEventType,
  side: VisionSide,
  home: string,
  away: string,
): { label: string; detail: string } {
  const team = side === "home" ? home : away;
  switch (type) {
    case "pase":
      return {
        label: "Pase",
        detail: `${team} progresa con un pase filtrado.`,
      };
    case "disparo":
      return {
        label: "Disparo",
        detail: `${team} prueba desde fuera del área.`,
      };
    case "falta":
      return { label: "Falta", detail: `Falta táctica sobre ${team}.` };
    case "tarjeta":
      return {
        label: "Tarjeta",
        detail: `Amonestación tras una entrada dura cerca de ${team}.`,
      };
    case "corner":
      return { label: "Córner", detail: `Córner a favor de ${team}.` };
    case "cambio":
      return {
        label: "Cambio",
        detail: `${team} ajusta el once para refrescar el mediocampo.`,
      };
    case "ataque_peligroso":
      return {
        label: "Ataque peligroso",
        detail: `${team} llega con peligro al área rival.`,
      };
  }
}

function ballForEvent(type: VisionEventType, side: VisionSide): PitchPoint {
  const attackX = side === "home" ? 75 : 25;
  const defendX = side === "home" ? 30 : 70;
  switch (type) {
    case "disparo":
    case "ataque_peligroso":
      return {
        x: clamp(jitter(attackX, 8), 5, 95),
        y: clamp(jitter(45, 20), 10, 90),
      };
    case "corner":
      return {
        x: side === "home" ? 95 : 5,
        y: Math.random() > 0.5 ? 8 : 92,
      };
    case "falta":
    case "tarjeta":
      return {
        x: clamp(jitter(50, 25), 10, 90),
        y: clamp(jitter(50, 25), 15, 85),
      };
    case "cambio":
      return {
        x: clamp(jitter(50, 10), 40, 60),
        y: 96,
      };
    case "pase":
    default:
      return {
        x: clamp(jitter(defendX + (side === "home" ? 20 : -20), 15), 8, 92),
        y: clamp(jitter(50, 28), 12, 88),
      };
  }
}

function nudgePlayers(
  players: VisionLiveState["players"],
  ball: PitchPoint,
  side: VisionSide,
): VisionLiveState["players"] {
  return players.map((player) => {
    if (player.side !== side) {
      return {
        ...player,
        position: {
          x: clamp(jitter(player.position.x, 1.2), 4, 96),
          y: clamp(jitter(player.position.y, 1.2), 6, 94),
        },
      };
    }
    const pull = 0.08;
    return {
      ...player,
      position: {
        x: clamp(
          player.position.x + (ball.x - player.position.x) * pull + jitter(0, 0.8),
          4,
          96,
        ),
        y: clamp(
          player.position.y + (ball.y - player.position.y) * pull + jitter(0, 0.8),
          6,
          94,
        ),
      },
    };
  });
}

function nextRisk(momentum: number, pressure: number): {
  risk: VisionRiskLevel;
  riskLabel: string;
} {
  const stress = Math.abs(momentum) / 100 + pressure / 200;
  if (stress > 1.1) {
    return {
      risk: "high",
      riskLabel: "Partido abierto — alta volatilidad",
    };
  }
  if (stress > 0.7) {
    return {
      risk: "medium",
      riskLabel: "Transiciones rápidas del visitante",
    };
  }
  return {
    risk: "low",
    riskLabel: "Ritmo controlado",
  };
}

/**
 * Advance the mock live match by one tick (~5s of UI time).
 * Pure function — easy to replace with server push payloads.
 */
export function simulateVisionTick(prev: VisionLiveState): VisionLiveState {
  const type = EVENT_TYPES[Math.floor(Math.random() * EVENT_TYPES.length)]!;
  const side = pickSide(prev.momentum);
  const ballTo = ballForEvent(type, side);
  const copy = eventCopy(
    type,
    side,
    prev.homeTeam.name,
    prev.awayTeam.name,
  );

  const minute = Math.min(90, prev.minute + (Math.random() > 0.65 ? 1 : 0));
  const rawMomentumDelta =
    side === "home"
      ? 6 + Math.random() * 10
      : -(6 + Math.random() * 10);
  const appliedMomentumDelta = rawMomentumDelta * 0.65;
  const momentum = clamp(prev.momentum + appliedMomentumDelta, -100, 100);

  const pressureSide: VisionSide =
    type === "ataque_peligroso" || type === "disparo" || type === "corner"
      ? side
      : prev.pressureSide;
  const pressure = clamp(
    pressureSide === side
      ? prev.pressure + 4 + Math.random() * 8
      : prev.pressure - 3 - Math.random() * 6,
    15,
    95,
  );

  let possessionHome = prev.possessionHome;
  if (side === "home") possessionHome += 1.2 + Math.random();
  else possessionHome -= 1.2 + Math.random();
  possessionHome = clamp(possessionHome, 35, 70);

  const marketsBefore = prev.markets;
  const markets = {
    homeWin: clamp01(prev.markets.homeWin + (side === "home" ? 0.012 : -0.01)),
    draw: clamp01(prev.markets.draw + jitter(0, 0.008)),
    awayWin: clamp01(prev.markets.awayWin + (side === "away" ? 0.012 : -0.01)),
    over25: clamp01(
      prev.markets.over25 +
        (type === "disparo" || type === "ataque_peligroso" ? 0.015 : -0.004),
    ),
    btts: clamp01(prev.markets.btts + jitter(0, 0.01)),
  };

  // Renormalize 1X2 lightly
  const sum = markets.homeWin + markets.draw + markets.awayWin;
  markets.homeWin /= sum;
  markets.draw /= sum;
  markets.awayWin /= sum;

  const confidence = clamp01(
    prev.confidence + (type === "ataque_peligroso" ? 0.02 : jitter(0, 0.015)),
  );
  const { risk, riskLabel } = nextRisk(momentum, pressure);

  const probabilityImpact = buildProbabilityImpact(marketsBefore, markets);
  const intel = buildTimelineIntelligence({
    type,
    side,
    homeName: prev.homeTeam.name,
    awayName: prev.awayTeam.name,
    momentumDelta: appliedMomentumDelta,
    before: marketsBefore,
    after: markets,
  });

  const event: VisionLiveEvent = {
    id: `evt-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    minute,
    type,
    side,
    label: copy.label,
    detail: copy.detail,
    ballTo,
    aiExplanation: intel.aiExplanation,
    momentumDelta: appliedMomentumDelta,
    probabilityImpact,
    marketsAfter: { ...markets },
    whyChanged: intel.whyChanged,
  };

  const events = [event, ...prev.events].slice(0, 12);

  return {
    ...prev,
    minute,
    ball: ballTo,
    players: nudgePlayers(prev.players, ballTo, side),
    momentum,
    pressure,
    pressureSide,
    possessionHome,
    markets,
    confidence,
    risk,
    riskLabel,
    aiInsight: intel.aiExplanation,
    events,
  };
}

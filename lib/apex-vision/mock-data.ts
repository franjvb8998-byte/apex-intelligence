import type { PitchPoint, VisionLiveState, VisionPlayer } from "@/lib/apex-vision/types";

function lineup(
  side: "home" | "away",
  slots: Array<{ number: number; name: string; x: number; y: number }>,
): VisionPlayer[] {
  return slots.map((slot) => ({
    id: `${side}-${slot.number}`,
    side,
    number: slot.number,
    name: slot.name,
    position: { x: slot.x, y: slot.y },
  }));
}

/** 4-3-3 home (left) / away (right) — percentages on the pitch. */
export function createInitialPlayers(): VisionPlayer[] {
  const home = lineup("home", [
    { number: 1, name: "Ortega", x: 8, y: 50 },
    { number: 2, name: "Vargas", x: 22, y: 18 },
    { number: 4, name: "Molina", x: 20, y: 38 },
    { number: 5, name: "Ruiz", x: 20, y: 62 },
    { number: 3, name: "Paredes", x: 22, y: 82 },
    { number: 6, name: "Soto", x: 35, y: 30 },
    { number: 8, name: "Núñez", x: 34, y: 50 },
    { number: 10, name: "Ibarra", x: 35, y: 70 },
    { number: 7, name: "Campos", x: 48, y: 22 },
    { number: 9, name: "Reyes", x: 52, y: 50 },
    { number: 11, name: "Delgado", x: 48, y: 78 },
  ]);

  const away = lineup("away", [
    { number: 1, name: "Hart", x: 92, y: 50 },
    { number: 2, name: "Cole", x: 78, y: 18 },
    { number: 5, name: "Burns", x: 80, y: 38 },
    { number: 6, name: "Shaw", x: 80, y: 62 },
    { number: 3, name: "Lane", x: 78, y: 82 },
    { number: 8, name: "Price", x: 65, y: 30 },
    { number: 4, name: "Owen", x: 66, y: 50 },
    { number: 10, name: "Quinn", x: 65, y: 70 },
    { number: 7, name: "Fox", x: 52, y: 22 },
    { number: 9, name: "Blake", x: 48, y: 50 },
    { number: 11, name: "Reed", x: 52, y: 78 },
  ]);

  // Resolve collision: home #9 and away #9 both near center — nudge away striker.
  const adjustedAway = away.map((player) =>
    player.number === 9
      ? { ...player, position: { x: 55, y: 48 } as PitchPoint }
      : player,
  );

  return [...home, ...adjustedAway];
}

/**
 * Seed state for APEX Vision.
 * TODO(realtime): replace with Data Platform / live feed projection.
 */
export function createInitialVisionState(): VisionLiveState {
  return {
    matchId: "apex:vision:mock:live-001",
    leagueName: "Premier League",
    homeTeam: {
      id: "home",
      name: "Northbridge FC",
      shortName: "NOR",
    },
    awayTeam: {
      id: "away",
      name: "Southport United",
      shortName: "SOU",
    },
    score: { home: 1, away: 0 },
    minute: 67,
    players: createInitialPlayers(),
    ball: { x: 58, y: 42 },
    momentum: 28,
    pressure: 62,
    pressureSide: "home",
    possessionHome: 57,
    markets: {
      homeWin: 0.56,
      draw: 0.24,
      awayWin: 0.2,
      over25: 0.61,
      btts: 0.54,
    },
    confidence: 0.64,
    risk: "medium",
    riskLabel: "Transiciones rápidas del visitante",
    aiInsight:
      "La presión alta del equipo local está generando recuperaciones cerca del área rival.",
    events: [
      {
        id: "evt-seed-1",
        minute: 64,
        type: "ataque_peligroso",
        side: "home",
        label: "Ataque peligroso",
        detail: "Northbridge combina por banda derecha.",
        ballTo: { x: 72, y: 28 },
        aiExplanation:
          "La secuencia peligrosa de Northbridge FC empuja momentum y probabilidad de victoria.",
        momentumDelta: 8.4,
        probabilityImpact: {
          homeWin: 0.018,
          draw: -0.008,
          awayWin: -0.01,
          over25: 0.012,
          btts: 0.004,
        },
        marketsAfter: {
          homeWin: 0.55,
          draw: 0.25,
          awayWin: 0.2,
          over25: 0.59,
          btts: 0.53,
        },
        whyChanged: [
          {
            id: "f1",
            label: "Tipo de evento",
            direction: "neutral",
            detail: "ataque peligroso protagonizado por Northbridge FC.",
          },
          {
            id: "f2",
            label: "Variación de momentum",
            direction: "positive",
            detail: "Momentum +8.4 tras la acción.",
          },
          {
            id: "f3",
            label: "Impacto 1X2",
            direction: "positive",
            detail: "Local +1.8 pp · Empate -0.8 pp · Visitante -1.0 pp.",
          },
        ],
      },
      {
        id: "evt-seed-2",
        minute: 66,
        type: "disparo",
        side: "home",
        label: "Disparo",
        detail: "Remate desviado desde la frontal.",
        ballTo: { x: 88, y: 48 },
        aiExplanation:
          "El remate de Northbridge FC eleva la amenaza ofensiva y recalibra Over 2.5 / 1X2.",
        momentumDelta: 5.2,
        probabilityImpact: {
          homeWin: 0.01,
          draw: -0.004,
          awayWin: -0.006,
          over25: 0.015,
          btts: 0.002,
        },
        marketsAfter: {
          homeWin: 0.56,
          draw: 0.24,
          awayWin: 0.2,
          over25: 0.61,
          btts: 0.54,
        },
        whyChanged: [
          {
            id: "f1",
            label: "Tipo de evento",
            direction: "neutral",
            detail: "disparo protagonizado por Northbridge FC.",
          },
          {
            id: "f2",
            label: "Over 2.5",
            direction: "positive",
            detail: "Over 2.5 +1.5 pp por el perfil del evento.",
          },
          {
            id: "f3",
            label: "Variación de momentum",
            direction: "positive",
            detail: "Momentum +5.2 tras la acción.",
          },
        ],
      },
    ],
    source: "mock",
  };
}

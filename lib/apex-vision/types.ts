/**
 * APEX Vision — live match view-model.
 * Mock-first; swap simulateTick() for a realtime feed later.
 */

export type PitchPoint = {
  /** 0–100, left → right (home attacks toward 100). */
  x: number;
  /** 0–100, top → bottom. */
  y: number;
};

export type VisionSide = "home" | "away";

export type VisionEventType =
  | "pase"
  | "disparo"
  | "falta"
  | "tarjeta"
  | "corner"
  | "cambio"
  | "ataque_peligroso";

export type VisionPlayer = {
  id: string;
  side: VisionSide;
  number: number;
  name: string;
  position: PitchPoint;
};

/** Delta on market probabilities caused by this event (percentage points as fractions). */
export type ProbabilityImpact = {
  homeWin: number;
  draw: number;
  awayWin: number;
  over25: number;
  btts: number;
};

/** Factor shown under “¿Por qué cambió?” */
export type TimelineChangeFactor = {
  id: string;
  label: string;
  direction: "positive" | "negative" | "neutral";
  detail: string;
};

/**
 * Chronological Intelligence Timeline™ entry.
 * Ready to map from a real live feed + model delta later.
 */
export type VisionLiveEvent = {
  id: string;
  minute: number;
  type: VisionEventType;
  side: VisionSide;
  label: string;
  detail: string;
  ballTo: PitchPoint;
  /** AI narrative for why markets/momentum moved. */
  aiExplanation: string;
  /** Signed momentum change (−100…+100 scale contribution). */
  momentumDelta: number;
  /** Probability deltas vs previous tick (already renormalized 1X2). */
  probabilityImpact: ProbabilityImpact;
  /** Snapshot after applying the event (optional display aid). */
  marketsAfter: {
    homeWin: number;
    draw: number;
    awayWin: number;
    over25: number;
    btts: number;
  };
  whyChanged: TimelineChangeFactor[];
};

export type VisionMarkets = {
  /** Home win probability [0,1]. */
  homeWin: number;
  draw: number;
  awayWin: number;
  over25: number;
  btts: number;
};

export type VisionRiskLevel = "low" | "medium" | "high";

export type VisionLiveState = {
  matchId: string;
  leagueName: string;
  homeTeam: { id: string; name: string; shortName: string };
  awayTeam: { id: string; name: string; shortName: string };
  score: { home: number; away: number };
  minute: number;
  players: VisionPlayer[];
  ball: PitchPoint;
  /** -100 (away) … +100 (home). */
  momentum: number;
  /** 0–100 pressure toward the attacking third of `pressureSide`. */
  pressure: number;
  pressureSide: VisionSide;
  possessionHome: number;
  markets: VisionMarkets;
  confidence: number;
  risk: VisionRiskLevel;
  riskLabel: string;
  aiInsight: string;
  events: VisionLiveEvent[];
  source: "mock";
};

import type {
  ProbabilityImpact,
  TimelineChangeFactor,
  VisionEventType,
  VisionMarkets,
  VisionSide,
} from "@/lib/apex-vision/types";

type BuildIntelInput = {
  type: VisionEventType;
  side: VisionSide;
  homeName: string;
  awayName: string;
  momentumDelta: number;
  before: VisionMarkets;
  after: VisionMarkets;
};

function delta(after: number, before: number): number {
  return after - before;
}

export function buildProbabilityImpact(
  before: VisionMarkets,
  after: VisionMarkets,
): ProbabilityImpact {
  return {
    homeWin: delta(after.homeWin, before.homeWin),
    draw: delta(after.draw, before.draw),
    awayWin: delta(after.awayWin, before.awayWin),
    over25: delta(after.over25, before.over25),
    btts: delta(after.btts, before.btts),
  };
}

/**
 * Mock AI explanation + causal factors for the Intelligence Timeline™.
 * TODO(realtime): replace with ExplainabilityModule / live inference deltas.
 */
export function buildTimelineIntelligence(input: BuildIntelInput): {
  aiExplanation: string;
  whyChanged: TimelineChangeFactor[];
} {
  const team = input.side === "home" ? input.homeName : input.awayName;
  const rival = input.side === "home" ? input.awayName : input.homeName;
  const impact = buildProbabilityImpact(input.before, input.after);
  const homeUp = impact.homeWin >= 0;

  const typeLine: Record<VisionEventType, string> = {
    pase: `La circulación de ${team} reorganiza el bloque y desplaza levemente las probabilidades.`,
    disparo: `El remate de ${team} eleva la amenaza ofensiva y recalibra Over 2.5 / 1X2.`,
    falta: `La falta frena el ritmo; el modelo reduce temporalmente la convicción del ataque de ${team}.`,
    tarjeta: `La amonestación aumenta el riesgo disciplinario y la cautela de ${team}.`,
    corner: `El córner concentra xG de set-piece a favor de ${team}.`,
    cambio: `El cambio de ${team} altera el perfil de intensidad; el modelo reestima el tramo final.`,
    ataque_peligroso: `La secuencia peligrosa de ${team} empuja momentum y probabilidad de victoria.`,
  };

  const whyChanged: TimelineChangeFactor[] = [
    {
      id: "event-type",
      label: "Tipo de evento",
      direction: "neutral",
      detail: `${input.type.replace(/_/g, " ")} protagonizado por ${team}.`,
    },
    {
      id: "momentum",
      label: "Variación de momentum",
      direction:
        input.momentumDelta > 1
          ? "positive"
          : input.momentumDelta < -1
            ? "negative"
            : "neutral",
      detail: `Momentum ${input.momentumDelta >= 0 ? "+" : ""}${input.momentumDelta.toFixed(1)} tras la acción.`,
    },
    {
      id: "1x2",
      label: "Impacto 1X2",
      direction: homeUp ? "positive" : "negative",
      detail: `Local ${formatPp(impact.homeWin)} · Empate ${formatPp(impact.draw)} · Visitante ${formatPp(impact.awayWin)}.`,
    },
    {
      id: "context",
      label: "Contexto táctico",
      direction:
        input.type === "ataque_peligroso" || input.type === "disparo"
          ? "positive"
          : "neutral",
      detail:
        input.side === "home"
          ? `${team} fuerza a ${rival} a defender más atrás.`
          : `${team} encuentra espacios a la espalda del bloque local.`,
    },
  ];

  if (Math.abs(impact.over25) >= 0.005) {
    whyChanged.push({
      id: "ou25",
      label: "Over 2.5",
      direction: impact.over25 >= 0 ? "positive" : "negative",
      detail: `Over 2.5 ${formatPp(impact.over25)} por el perfil del evento.`,
    });
  }

  return {
    aiExplanation: typeLine[input.type],
    whyChanged,
  };
}

function formatPp(value: number): string {
  const pp = value * 100;
  const sign = pp > 0 ? "+" : "";
  return `${sign}${pp.toFixed(1)} pp`;
}

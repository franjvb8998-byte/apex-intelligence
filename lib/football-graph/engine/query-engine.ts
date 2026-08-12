import type {
  FootballGraphQueryEngine,
  GraphNodeRepository,
  MatchGraphRepository,
} from "@/lib/football-graph/contracts";
import type {
  DiscoveredPattern,
  GraphId,
  MatchNeighborhood,
  MatchNode,
  MatchSimilarityScore,
  MetricNode,
  PatternQuery,
  PlayingStyleNode,
  SimilarityQuery,
} from "@/lib/football-graph/types";

const DEFAULT_WEIGHTS = {
  scoreline: 0.25,
  competition: 0.15,
  style: 0.25,
  tempo: 0.1,
  xg_profile: 0.15,
  events: 0.1,
} as const;

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function scorelineSimilarity(a: MatchNode, b: MatchNode): number {
  if (a.homeScore == null || a.awayScore == null) return 0.3;
  if (b.homeScore == null || b.awayScore == null) return 0.3;
  const diff =
    Math.abs(a.homeScore - b.homeScore) + Math.abs(a.awayScore - b.awayScore);
  return clamp01(1 - diff / 6);
}

function styleDistance(a: PlayingStyleNode, b: PlayingStyleNode): number {
  const keys = ["possession", "pressing", "directness", "width", "tempo"] as const;
  let sum = 0;
  for (const key of keys) {
    sum += Math.abs(a.axes[key] - b.axes[key]);
  }
  return clamp01(1 - sum / keys.length);
}

/**
 * In-process query engine over injected repositories.
 * TODO(ml): replace heuristics with embeddings / trained similarity.
 */
export class DefaultFootballGraphQueryEngine
  implements FootballGraphQueryEngine
{
  constructor(
    private readonly nodes: GraphNodeRepository,
    private readonly matches: MatchGraphRepository,
  ) {}

  async getNeighborhood(matchId: GraphId): Promise<MatchNeighborhood | null> {
    return this.matches.getMatch(matchId);
  }

  async findSimilarMatches(
    query: SimilarityQuery,
  ): Promise<MatchSimilarityScore[]> {
    const source = await this.matches.getMatch(query.matchId);
    if (!source) return [];

    const all = await this.matches.listMatches();
    const weights: Record<keyof typeof DEFAULT_WEIGHTS, number> = {
      ...DEFAULT_WEIGHTS,
      ...query.weights,
    };
    const weightSum = Object.values(weights).reduce((a, b) => a + b, 0);
    const results: MatchSimilarityScore[] = [];

    for (const candidate of all) {
      if (candidate.id === query.matchId) continue;
      const neighborhood = await this.matches.getMatch(candidate.id);
      if (!neighborhood) continue;

      const dimensions = await this.scoreDimensions(
        source,
        neighborhood,
        weights,
      );
      const score =
        dimensions.reduce((sum, d) => sum + d.score * d.weight, 0) / weightSum;

      results.push({
        matchId: query.matchId,
        candidateMatchId: candidate.id,
        score,
        dimensions,
        rationale: dimensions
          .filter((d) => d.score >= 0.6)
          .map((d) => `${d.key}: ${(d.score * 100).toFixed(0)}%`),
      });
    }

    return results.sort((a, b) => b.score - a.score).slice(0, query.limit ?? 5);
  }

  async discoverPatterns(query: PatternQuery = {}): Promise<DiscoveredPattern[]> {
    const matches = await this.matches.listMatches(query.competitionId);
    const scoped = query.matchIds
      ? matches.filter((m) => query.matchIds!.includes(m.id))
      : matches;

    const patterns: DiscoveredPattern[] = [];
    const lateGoals = await this.findLateGoalPattern(scoped);
    if (lateGoals) patterns.push(lateGoals);
    const dominance = await this.findDominanceWithoutGoals(scoped);
    if (dominance) patterns.push(dominance);
    const highPress = await this.findHighPressPattern(scoped);
    if (highPress) patterns.push(highPress);

    return patterns.filter((pattern) => {
      if (query.kinds && !query.kinds.includes(pattern.kind)) return false;
      if (
        query.minConfidence != null &&
        pattern.confidence < query.minConfidence
      ) {
        return false;
      }
      return true;
    });
  }

  private async scoreDimensions(
    source: MatchNeighborhood,
    candidate: MatchNeighborhood,
    weights: Record<keyof typeof DEFAULT_WEIGHTS, number>,
  ) {
    const sameCompetition =
      source.match.competitionId === candidate.match.competitionId ? 1 : 0.2;
    const scoreline = scorelineSimilarity(source.match, candidate.match);
    const sourceStyles = await this.loadStyles(source.relatedIds.styleIds);
    const candidateStyles = await this.loadStyles(candidate.relatedIds.styleIds);
    const style = this.compareStyles(sourceStyles, candidateStyles);
    const sourceMetrics = await this.loadMetrics(source.relatedIds.metricIds);
    const candidateMetrics = await this.loadMetrics(
      candidate.relatedIds.metricIds,
    );
    const xg = this.compareXg(sourceMetrics, candidateMetrics);
    const tempo = this.compareTempo(sourceStyles, candidateStyles);
    const events = this.compareEventDensity(
      source.relatedIds.eventIds.length,
      candidate.relatedIds.eventIds.length,
    );

    return [
      { key: "scoreline" as const, score: scoreline, weight: weights.scoreline },
      {
        key: "competition" as const,
        score: sameCompetition,
        weight: weights.competition,
      },
      { key: "style" as const, score: style, weight: weights.style },
      { key: "tempo" as const, score: tempo, weight: weights.tempo },
      { key: "xg_profile" as const, score: xg, weight: weights.xg_profile },
      { key: "events" as const, score: events, weight: weights.events },
    ];
  }

  private async loadStyles(ids: GraphId[]): Promise<PlayingStyleNode[]> {
    const out: PlayingStyleNode[] = [];
    for (const id of ids) {
      const node = await this.nodes.getById(id);
      if (node?.kind === "playing_style") out.push(node);
    }
    return out;
  }

  private async loadMetrics(ids: GraphId[]): Promise<MetricNode[]> {
    const out: MetricNode[] = [];
    for (const id of ids) {
      const node = await this.nodes.getById(id);
      if (node?.kind === "metric") out.push(node);
    }
    return out;
  }

  private compareStyles(
    a: PlayingStyleNode[],
    b: PlayingStyleNode[],
  ): number {
    if (a.length === 0 || b.length === 0) return 0.4;
    return styleDistance(a[0]!, b[0]!);
  }

  private compareTempo(a: PlayingStyleNode[], b: PlayingStyleNode[]): number {
    if (a.length === 0 || b.length === 0) return 0.4;
    return clamp01(1 - Math.abs(a[0]!.axes.tempo - b[0]!.axes.tempo));
  }

  private compareXg(a: MetricNode[], b: MetricNode[]): number {
    const ax = a.filter((m) => m.key === "xg");
    const bx = b.filter((m) => m.key === "xg");
    if (ax.length === 0 || bx.length === 0) return 0.35;
    const aTotal = ax.reduce((s, m) => s + m.value, 0);
    const bTotal = bx.reduce((s, m) => s + m.value, 0);
    return clamp01(1 - Math.abs(aTotal - bTotal) / 3);
  }

  private compareEventDensity(a: number, b: number): number {
    const max = Math.max(a, b, 1);
    return clamp01(1 - Math.abs(a - b) / max);
  }

  private async findLateGoalPattern(
    matches: MatchNode[],
  ): Promise<DiscoveredPattern | null> {
    const matchIds: GraphId[] = [];
    for (const match of matches) {
      const neighborhood = await this.matches.getMatch(match.id);
      if (!neighborhood) continue;
      for (const eventId of neighborhood.relatedIds.eventIds) {
        const event = await this.nodes.getById(eventId);
        if (
          event?.kind === "event" &&
          event.eventType === "goal" &&
          (event.minute ?? 0) >= 80
        ) {
          matchIds.push(match.id);
          break;
        }
      }
    }
    if (matchIds.length === 0) return null;
    return {
      id: "pattern-late-goal",
      kind: "late_equalizer",
      label: "Goles tardíos",
      matchIds,
      confidence: clamp01(0.55 + matchIds.length * 0.1),
      signals: ["goal after 80'"],
      summary:
        "Partidos con al menos un gol en el tramo final (≥80'). Señal mock de volatilidad tardía.",
    };
  }

  private async findDominanceWithoutGoals(
    matches: MatchNode[],
  ): Promise<DiscoveredPattern | null> {
    const matchIds: GraphId[] = [];
    for (const match of matches) {
      const neighborhood = await this.matches.getMatch(match.id);
      if (!neighborhood) continue;
      const metrics = await this.loadMetrics(neighborhood.relatedIds.metricIds);
      const totalXg = metrics
        .filter((m) => m.key === "xg")
        .reduce((s, m) => s + m.value, 0);
      const goals = (match.homeScore ?? 0) + (match.awayScore ?? 0);
      if (totalXg >= 1.5 && goals <= 1) matchIds.push(match.id);
    }
    if (matchIds.length === 0) return null;
    return {
      id: "pattern-dominance-xg",
      kind: "dominance_without_goals",
      label: "Dominio sin premio",
      matchIds,
      confidence: clamp01(0.5 + matchIds.length * 0.12),
      signals: ["high xG", "low goals"],
      summary:
        "Encuentros con xG acumulado alto relativo a goles convertidos (heurística mock).",
    };
  }

  private async findHighPressPattern(
    matches: MatchNode[],
  ): Promise<DiscoveredPattern | null> {
    const matchIds: GraphId[] = [];
    for (const match of matches) {
      const neighborhood = await this.matches.getMatch(match.id);
      if (!neighborhood) continue;
      const styles = await this.loadStyles(neighborhood.relatedIds.styleIds);
      if (styles.some((style) => style.axes.pressing >= 0.75)) {
        matchIds.push(match.id);
      }
    }
    if (matchIds.length === 0) return null;
    return {
      id: "pattern-high-press",
      kind: "high_press_collapse",
      label: "Presión alta",
      matchIds,
      confidence: clamp01(0.6 + matchIds.length * 0.08),
      signals: ["pressing axis ≥ 0.75"],
      summary:
        "Partidos donde al menos un equipo exhibe estilo de pressing elevado.",
    };
  }
}

export function createFootballGraphQueryEngine(
  nodes: GraphNodeRepository,
  matches: MatchGraphRepository,
): FootballGraphQueryEngine {
  return new DefaultFootballGraphQueryEngine(nodes, matches);
}

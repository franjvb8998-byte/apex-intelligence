/**
 * Build a Copilot snapshot from Match Center + AI Match Analysis.
 * Only copies published APEX fields.
 */

import { edgePp, fairOdds, impliedProbability } from "@/lib/copilot/pricing";
import type { CopilotMarketLine, CopilotMatchSnapshot } from "@/lib/copilot/types";
import type { MatchCenterData } from "@/lib/match-center/types";
import {
  canPublishFrozenCurrentBet,
  frozenRecommendation,
  frozenSelectionOutcome,
  frozenValueBet,
} from "@/lib/prematch-decision/frozen-betting";

function teamBlock(
  side: "home" | "away",
  data: MatchCenterData,
): CopilotMatchSnapshot["home"] {
  const meta = data.match[side === "home" ? "homeTeam" : "awayTeam"];
  const form = data.preview.dashboard.form[side];
  return {
    id: meta.id,
    name: meta.name,
    form: form?.form ?? data.aiAnalysis.recentForm[side],
    played: form?.played ?? null,
    wins: form?.wins ?? null,
    draws: form?.draws ?? null,
    losses: form?.losses ?? null,
    goalsFor: form?.goalsFor ?? null,
    goalsAgainst: form?.goalsAgainst ?? null,
  };
}

function marketLines(data: MatchCenterData): CopilotMarketLine[] {
  const best = data.preview.dashboard.odds.filter((row) => row.isBest);
  const source = best.length > 0 ? best : data.preview.dashboard.odds;
  return source.map((row) => ({
    market: row.marketLabel,
    selection: row.selection,
    label: row.label,
    modelProbability: row.modelProbability,
    fairOdds: fairOdds(row.modelProbability),
    decimalOdds: row.decimalOdds,
    impliedProbability:
      row.impliedProbability ?? impliedProbability(row.decimalOdds),
    edge: edgePp(row.modelProbability, row.decimalOdds),
    expectedValue: row.expectedValue,
    bookmaker: row.bookmaker,
  }));
}

export function snapshotFromMatchCenter(data: MatchCenterData): CopilotMatchSnapshot {
  const analysis = data.aiAnalysis;
  const ticket = data.preview.analysis.frozenPrematchDecision ?? null;
  const publishable = ticket != null && canPublishFrozenCurrentBet(ticket);
  const frozenRec = publishable && ticket ? frozenRecommendation(ticket) : null;
  const frozenValue = publishable && ticket ? frozenValueBet(ticket) : null;
  const value = publishable ? frozenValue : ticket ? null : analysis.valueBet;
  const homeLineup = data.preview.dashboard.lineups.home;
  const awayLineup = data.preview.dashboard.lineups.away;
  const live =
    data.match.status === "live"
      ? {
          minute: data.live.vision.minute,
          home: data.live.vision.score.home,
          away: data.live.vision.score.away,
        }
      : null;
  return {
    matchId: data.match.matchId,
    externalId: data.match.externalId ?? null,
    leagueName: data.match.leagueName,
    kickoffAt: data.match.kickoffAt,
    status: data.match.status,
    home: teamBlock("home", data),
    away: teamBlock("away", data),
    oneXTwo: analysis.prediction.oneXTwo,
    overUnder25: data.preview.hybrid.overUnder25,
    btts: data.preview.hybrid.btts,
    expectedGoals: analysis.expectedGoals,
    predictedOutcome: publishable && ticket
      ? frozenSelectionOutcome(ticket)
      : ticket
        ? null
        : analysis.prediction.outcome,
    predictedLabel: publishable && ticket
      ? ticket.scoring?.selectionLabel?.trim() ?? ""
      : ticket
        ? ""
        : analysis.prediction.label,
    confidence: publishable && ticket
      ? {
          value:
            typeof ticket.scoring?.confidence === "number" &&
            Number.isFinite(ticket.scoring.confidence)
              ? ticket.scoring.confidence
              : null,
          band: ticket.scoring?.confidenceBand ?? null,
        }
      : ticket
        ? { value: null, band: null }
        : {
            value: analysis.confidence.value,
            band: analysis.confidence.band,
          },
    modelVersion: analysis.prediction.modelVersion,
    elo: {
      home: data.preview.eloInput.homeElo,
      away: data.preview.eloInput.awayElo,
      estimated: true,
    },
    strengths: analysis.strengths.map((item) => ({
      label: item.label,
      detail: item.detail,
    })),
    weaknesses: analysis.weaknesses.map((item) => ({
      label: item.label,
      detail: item.detail,
    })),
    tactical: analysis.tacticalFactors.map((item) => ({
      label: item.label,
      detail: item.detail,
    })),
    recommendation:
      publishable && frozenRec
        ? frozenRec
        : ticket
          ? { id: "frozen-unavailable", title: "", rationale: "" }
          : analysis.recommendation,
    valueBet: value
      ? {
          market: value.market,
          selection: value.selection,
          modelProbability: value.modelProbability,
          decimalOdds: value.decimalOdds,
          edge: value.edge,
          kellyFraction: value.kellyFraction ?? null,
          explanation: value.explanation ?? null,
        }
      : null,
    markets: marketLines(data),
    injuries: data.preview.dashboard.injuries.map((item) => ({
      playerName: item.playerName,
      teamName: item.teamName,
      detail: item.detail,
    })),
    h2h: data.preview.dashboard.h2h.map((item) => ({
      kickoffAt: item.kickoffAt,
      homeTeamName: item.homeTeamName,
      awayTeamName: item.awayTeamName,
      homeGoals: item.homeGoals,
      awayGoals: item.awayGoals,
    })),
    provenance: analysis.source,
    lineupsPublished: Boolean(
      (homeLineup?.startXI.length ?? 0) > 0 || (awayLineup?.startXI.length ?? 0) > 0,
    ),
    liveState: live,
    decision: publishable ? undefined : ticket ? undefined : data.preview.analysis.decision,
    scoring: ticket ? undefined : data.preview.analysis.scoring,
  };
}

export function matchLabelFromSnapshot(snapshot: CopilotMatchSnapshot): string {
  return `${snapshot.home.name} vs ${snapshot.away.name}`;
}

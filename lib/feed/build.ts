import type { ApexTone } from "@/components/design-system/tokens";
import {
  discoveryPriority,
  discoveryRecommendation,
} from "@/lib/apex-opportunities/discovery";
import {
  formatKickoff,
  formatOdds,
  formatSignedPct,
  SCORING_BADGE_TONE,
} from "@/lib/apex-opportunities/display";
import {
  opportunityAnalysisHref,
  opportunityBankrollHref,
} from "@/lib/apex-opportunities/hrefs";
import type { ApexOpportunity } from "@/lib/apex-opportunities/types";
import { formatMoney, formatSignedMoney } from "@/lib/bankroll/currency";
import { formatPct } from "@/lib/bankroll/format";
import type { BankrollBet, BankrollData } from "@/lib/bankroll/types";
import type { DashboardMatchSummary } from "@/lib/dashboard/types";
import {
  fixtureIdFromMatch,
  matchAnalysisHref,
} from "@/lib/match-center/fixture-id";
import type { MatchCenterAbsence } from "@/lib/match-center/types";
import type { PortfolioReport } from "@/lib/portfolio/types";
import { FEED_ROW_LIMIT, type FeedCardModel, type FeedKpi, type FeedRow } from "@/lib/feed/types";

export function confidenceTone(value: number | null | undefined): ApexTone {
  if (value == null || !Number.isFinite(value)) return "neutral";
  if (value >= 70) return "success";
  if (value >= 45) return "warning";
  return "danger";
}

export function signedTone(value: number | null | undefined): ApexTone {
  if (value == null || !Number.isFinite(value) || value === 0) return "neutral";
  return value > 0 ? "success" : "danger";
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, n) => sum + n, 0) / values.length;
}

function formatConf(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return String(Math.round(value));
}

function analysisHref(fixtureId: string): string {
  return opportunityAnalysisHref(fixtureId);
}

function matchHref(match: DashboardMatchSummary): string {
  const id = fixtureIdFromMatch(match);
  return id ? matchAnalysisHref(id) : "/match-center";
}

function matchLabel(match: DashboardMatchSummary): string {
  return `${match.homeTeam.name} vs ${match.awayTeam.name}`;
}

export function hrefForMatchName(
  label: string,
  fixtures: DashboardMatchSummary[],
): string {
  const needle = label.trim().toLowerCase();
  const hit = fixtures.find((match) => {
    const home = match.homeTeam.name.toLowerCase();
    const away = match.awayTeam.name.toLowerCase();
    return (
      needle === `${home} vs ${away}` ||
      (needle.includes(home) && needle.includes(away))
    );
  });
  return hit ? matchHref(hit) : "/bankroll";
}

function opportunityRow(row: ApexOpportunity): FeedRow {
  const rec = discoveryRecommendation(row);
  return {
    id: row.fixtureId,
    href: analysisHref(row.fixtureId),
    title: `${row.home.name} vs ${row.away.name}`,
    subtitle: `${row.leagueName} · ${formatKickoff(row.kickoffAt)} · ${row.selectionLabel}`,
    badge: {
      label: rec,
      tone: SCORING_BADGE_TONE[row.recommendation],
    },
    confidence: row.confidence,
    kpis: [
      { label: "Score", value: String(Math.round(row.score)), tone: "accent" },
      {
        label: "Conf",
        value: formatConf(row.confidence),
        tone: confidenceTone(row.confidence),
      },
      {
        label: "EV",
        value: formatSignedPct(row.expectedValue),
        tone: signedTone(row.expectedValue),
      },
    ],
  };
}

export function buildEliteCard(analyzed: ApexOpportunity[]): FeedCardModel {
  const elite = analyzed.filter(
    (row) => row.recommendation === "Elite" || row.recommendation === "Strong Bet",
  );
  const ranked = [...analyzed].sort((a, b) => {
    const eliteDelta =
      Number(b.recommendation === "Elite" || b.recommendation === "Strong Bet") -
      Number(a.recommendation === "Elite" || a.recommendation === "Strong Bet");
    if (eliteDelta !== 0) return eliteDelta;
    if (b.score !== a.score) return b.score - a.score;
    return b.confidence - a.confidence;
  });
  const rows = ranked.slice(0, FEED_ROW_LIMIT).map(opportunityRow);
  const shown = ranked.slice(0, FEED_ROW_LIMIT);
  const avgConf = mean(shown.map((row) => row.confidence));

  return {
    kpis: [
      { label: "Elite", value: String(elite.length), tone: "accent" },
      { label: "Scan", value: String(analyzed.length) },
      {
        label: "kpi.avgConf",
        value: formatConf(avgConf),
        tone: confidenceTone(avgConf),
      },
    ],
    rows,
    emptyTitle: "empty.eliteTitle",
    emptyDescription: "empty.eliteDescription",
    footerHref: "/opportunities",
    footerLabel: "footer.openOpportunities",
  };
}

export function buildConfidenceMovers(analyzed: ApexOpportunity[]): FeedCardModel {
  const ranked = [...analyzed].sort((a, b) => {
    if (b.confidence !== a.confidence) return b.confidence - a.confidence;
    return b.score - a.score;
  });
  const high = analyzed.filter((row) => row.confidenceBand === "high").length;
  const top = ranked[0];
  return {
    kpis: [
      {
        label: "kpi.highBand",
        value: String(high),
        tone: high > 0 ? "success" : "neutral",
      },
      {
        label: "Peak",
        value: formatConf(top?.confidence),
        tone: confidenceTone(top?.confidence),
      },
      {
        label: "Vs 50",
        value: top
          ? `${top.confidence >= 50 ? "+" : ""}${Math.round(top.confidence - 50)}`
          : "—",
        tone: confidenceTone(top?.confidence),
      },
    ],
    rows: ranked.slice(0, FEED_ROW_LIMIT).map(opportunityRow),
    emptyTitle: "empty.confidenceTitle",
    emptyDescription: "empty.confidenceDescription",
    footerHref: "/opportunities",
    footerLabel: "footer.openOpportunities",
  };
}

export function buildMarketMovers(analyzed: ApexOpportunity[]): FeedCardModel {
  const ranked = [...analyzed].sort((a, b) => {
    const ev = Math.abs(b.expectedValue ?? 0) - Math.abs(a.expectedValue ?? 0);
    if (ev !== 0) return ev;
    return (b.marketEdge ?? 0) - (a.marketEdge ?? 0);
  });
  const positive = analyzed.filter((row) => row.positiveEdge).length;
  const best = ranked[0];
  return {
    kpis: [
      {
        label: "+EV",
        value: String(positive),
        tone: positive > 0 ? "success" : "neutral",
      },
      {
        label: "kpi.bestEv",
        value: formatSignedPct(best?.expectedValue ?? null),
        tone: signedTone(best?.expectedValue),
      },
      {
        label: "Odds",
        value: formatOdds(best?.bookmakerOdds ?? null),
      },
    ],
    rows: ranked.slice(0, FEED_ROW_LIMIT).map((row) => {
      const base = opportunityRow(row);
      return {
        ...base,
        kpis: [
          {
            label: "EV",
            value: formatSignedPct(row.expectedValue),
            tone: signedTone(row.expectedValue),
          },
          { label: "Odds", value: formatOdds(row.bookmakerOdds) },
          {
            label: "Fair",
            value: formatOdds(row.fairOdds),
          },
        ],
      };
    }),
    emptyTitle: "empty.marketTitle",
    emptyDescription: "empty.marketDescription",
    footerHref: "/opportunities",
    footerLabel: "footer.openOpportunities",
  };
}

export function buildAlertCard(input: {
  injuries: MatchCenterAbsence[];
  suspensions: MatchCenterAbsence[];
  featuredHref: string | null;
  featuredLabel: string | null;
  analyzed: ApexOpportunity[];
}): FeedCardModel {
  const rows: FeedRow[] = [];

  for (const injury of input.injuries.slice(0, 3)) {
    rows.push({
      id: `inj-${injury.id}`,
      href: input.featuredHref ?? "/match-center",
      title: injury.playerName,
      subtitle: [injury.teamName, injury.detail].filter(Boolean).join(" · "),
      badge: { label: "badge.injury", tone: "danger" },
      kpis: [{ label: "Desk", value: "INJ", tone: "danger" }],
    });
  }
  for (const ban of input.suspensions.slice(0, 2)) {
    if (rows.length >= FEED_ROW_LIMIT) break;
    rows.push({
      id: `sus-${ban.id}`,
      href: input.featuredHref ?? "/match-center",
      title: ban.playerName,
      subtitle: [ban.teamName, ban.detail].filter(Boolean).join(" · "),
      badge: { label: "badge.suspension", tone: "warning" },
      kpis: [{ label: "Desk", value: "SUS", tone: "warning" }],
    });
  }

  const deskNotes = [...input.analyzed]
    .sort((a, b) => b.riskScore - a.riskScore)
    .slice(0, FEED_ROW_LIMIT);
  for (const row of deskNotes) {
    if (rows.length >= FEED_ROW_LIMIT) break;
    if (rows.some((item) => item.id === row.fixtureId)) continue;
    const priority = discoveryPriority(row);
    rows.push({
      id: `desk-${row.fixtureId}`,
      href: analysisHref(row.fixtureId),
      title: `${row.home.shortName} vs ${row.away.shortName}`,
      subtitle: row.explanation,
      badge: { label: "badge.desk", tone: SCORING_BADGE_TONE[row.recommendation] },
      confidence: row.confidence,
      kpis: [
        { label: "Risk", value: row.riskBand, tone: "warning" },
        { label: priority.shortLabel, value: String(Math.round(row.score)) },
      ],
    });
  }

  return {
    kpis: [
      {
        label: "kpi.injuries",
        value: String(input.injuries.length),
        tone: input.injuries.length > 0 ? "danger" : "neutral",
      },
      {
        label: "kpi.bans",
        value: String(input.suspensions.length),
        tone: input.suspensions.length > 0 ? "warning" : "neutral",
      },
      {
        label: "kpi.desk",
        value: String(Math.min(deskNotes.length, FEED_ROW_LIMIT)),
      },
    ],
    rows,
    emptyTitle: "empty.alertsTitle",
    emptyDescription: "empty.alertsDescription",
    footerHref: input.featuredHref ?? "/match-center",
    footerLabel: input.featuredLabel ?? "footer.openMatchCenter",
  };
}

export function buildUpcomingCard(
  matches: DashboardMatchSummary[],
): FeedCardModel {
  const upcoming = matches
    .filter((match) => match.status === "scheduled" || match.status === "live")
    .sort((a, b) => Date.parse(a.kickoffAt) - Date.parse(b.kickoffAt));
  const live = upcoming.filter((match) => match.status === "live").length;
  return {
    kpis: [
      { label: "Live", value: String(live), tone: live > 0 ? "danger" : "neutral" },
      { label: "Next", value: String(upcoming.length) },
    ],
    rows: upcoming.slice(0, FEED_ROW_LIMIT).map((match) => ({
      id: match.id,
      href: matchHref(match),
      title: matchLabel(match),
      subtitle: [match.leagueName, formatKickoff(match.kickoffAt)]
        .filter(Boolean)
        .join(" · "),
      badge: {
        label: match.status === "live" ? "LIVE" : "KO",
        tone: match.status === "live" ? "danger" : "info",
      },
      kpis: [
        {
          label: "kpi.kickoff",
          value: formatKickoff(match.kickoffAt).split(", ").at(-1) ?? "—",
        },
      ],
    })),
    emptyTitle: "empty.upcomingTitle",
    emptyDescription: "empty.upcomingDescription",
    footerHref: "/match-center",
    footerLabel: "footer.openMatchCenter",
  };
}

export function buildFinishedCard(input: {
  matches: DashboardMatchSummary[];
  bets: BankrollBet[];
  fixtures: DashboardMatchSummary[];
}): FeedCardModel {
  const finished = input.matches
    .filter((match) => match.status === "finished")
    .sort((a, b) => Date.parse(b.kickoffAt) - Date.parse(a.kickoffAt));
  const settled = input.bets
    .filter((bet) => bet.result === "won" || bet.result === "lost")
    .sort((a, b) => Date.parse(b.placedAt) - Date.parse(a.placedAt));

  const rows: FeedRow[] = finished.slice(0, 2).map((match) => ({
    id: `fx-${match.id}`,
    href: matchHref(match),
    title: matchLabel(match),
    subtitle: [
      match.leagueName,
      `FT ${match.score.home ?? "—"}–${match.score.away ?? "—"}`,
    ]
      .filter(Boolean)
      .join(" · "),
    badge: { label: "FT", tone: "neutral" },
    kpis: [
      {
        label: "Score",
        value: `${match.score.home ?? "—"}–${match.score.away ?? "—"}`,
      },
    ],
  }));

  for (const bet of settled) {
    if (rows.length >= FEED_ROW_LIMIT) break;
    rows.push({
      id: bet.id,
      href: hrefForMatchName(bet.match, input.fixtures),
      title: bet.match,
      subtitle: `${bet.market} @ ${formatOdds(bet.odds)}`,
      badge: {
        label: bet.result === "won" ? "WON" : "LOST",
        tone: bet.result === "won" ? "success" : "danger",
      },
      kpis: [
        {
          label: "P/L",
          value:
            bet.profit == null
              ? "—"
              : formatSignedMoney(bet.profit, "HNL"),
          tone: signedTone(bet.profit),
        },
      ],
    });
  }

  return {
    kpis: [
      { label: "FT", value: String(finished.length) },
      {
        label: "kpi.settled",
        value: String(settled.length),
        tone: "info",
      },
    ],
    rows,
    emptyTitle: "empty.finishedTitle",
    emptyDescription: "empty.finishedDescription",
    footerHref: "/bankroll",
    footerLabel: "footer.openBankroll",
  };
}

export function buildPerformanceCard(
  data: BankrollData,
  report: PortfolioReport,
): FeedCardModel {
  const { metrics } = data;
  const kpis: FeedKpi[] = [
    {
      label: "ROI",
      value: formatPct(metrics.roi),
      tone: signedTone(metrics.roi),
    },
    {
      label: "kpi.winRate",
      value: formatPct(metrics.winRate, 0),
      tone: "info",
    },
    {
      label: "kpi.health",
      value: String(report.health.score),
      tone:
        report.health.band === "Excellent" || report.health.band === "Good"
          ? "success"
          : report.health.band === "Average"
            ? "warning"
            : "danger",
    },
  ];

  const rows: FeedRow[] = [
    {
      id: "pl",
      href: "/portfolio",
      title: "row.netPl",
      subtitle: "row.netPlSubtitle",
      kpis: [
        {
          label: "Total",
          value: formatSignedMoney(metrics.totalProfit, data.currency),
          tone: signedTone(metrics.totalProfit),
        },
      ],
    },
    {
      id: "yield",
      href: "/portfolio",
      title: "Yield",
      subtitle: "row.yieldSubtitle",
      kpis: [
        {
          label: "Yield",
          value: formatPct(metrics.yield),
          tone: signedTone(metrics.yield),
        },
      ],
    },
    {
      id: "bets",
      href: "/bankroll",
      title: "row.betsTitle",
      subtitle: "row.betsSubtitle",
      i18n: {
        count: metrics.betCount,
        amount: formatMoney(metrics.stakeRisked, data.currency),
      },
      kpis: [{ label: "N", value: String(metrics.betCount) }],
    },
    {
      id: "health",
      href: "/portfolio",
      title: "row.portfolioTitle",
      subtitle: report.insights[0]?.text ?? "row.portfolioSubtitleFallback",
      i18n: { band: report.health.band },
      badge: {
        label: report.health.band,
        tone: kpis[2]?.tone ?? "neutral",
      },
      kpis: [{ label: "Score", value: `${report.health.score}/100` }],
    },
  ];

  return {
    kpis,
    rows,
    emptyTitle: "empty.performanceTitle",
    emptyDescription: "empty.performanceDescription",
    footerHref: "/portfolio",
    footerLabel: "footer.openPortfolio",
  };
}

export function buildBankrollCard(
  data: BankrollData,
  report: PortfolioReport,
): FeedCardModel {
  const { metrics } = data;
  return {
    kpis: [
      {
        label: "kpi.bankroll",
        value: formatMoney(metrics.currentBankroll, data.currency),
        tone: "accent",
      },
      {
        label: "kpi.today",
        value: formatSignedMoney(metrics.todayProfit, data.currency),
        tone: signedTone(metrics.todayProfit),
      },
      {
        label: "kpi.open",
        value: formatMoney(report.kpis.activeExposure, data.currency),
        tone: "warning",
      },
    ],
    rows: [
      {
        id: "cash",
        href: "/bankroll",
        title: "row.currentCash",
        subtitle: "row.currentCashSubtitle",
        i18n: { amount: formatMoney(metrics.initialBankroll, data.currency) },
        kpis: [
          {
            label: "Now",
            value: formatMoney(metrics.currentBankroll, data.currency),
            tone: "accent",
          },
        ],
      },
      {
        id: "today",
        href: "/bankroll",
        title: "row.todayPl",
        subtitle: "row.todayPlSubtitle",
        kpis: [
          {
            label: "P/L",
            value: formatSignedMoney(metrics.todayProfit, data.currency),
            tone: signedTone(metrics.todayProfit),
          },
        ],
      },
      {
        id: "exposure",
        href: "/portfolio",
        title: "row.activeExposure",
        subtitle: "row.activeExposureSubtitle",
        i18n: {
          count: report.pendingCount,
          pct: formatPct(report.kpis.exposureRatio),
        },
        kpis: [
          {
            label: "Exp",
            value: formatMoney(report.kpis.activeExposure, data.currency),
            tone: "warning",
          },
        ],
      },
      {
        id: "add",
        href: "/opportunities",
        title: "row.addFromOpportunities",
        subtitle: "row.addFromOpportunitiesSubtitle",
        kpis: [{ label: "Go", value: "SCAN", tone: "accent" }],
      },
    ],
    emptyTitle: "empty.bankrollTitle",
    emptyDescription: "empty.bankrollDescription",
    footerHref: "/bankroll",
    footerLabel: "footer.openBankroll",
  };
}

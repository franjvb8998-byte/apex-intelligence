/**
 * Copilot domain service — APEX data in, briefing out.
 * Talks to CopilotAiClient only through the registry (no vendor imports).
 */

import { briefingToChatText, buildLocalBriefing } from "@/lib/copilot/analyst";
import type { CopilotAiClient } from "@/lib/copilot/ai/types";
import { createCopilotAiClient } from "@/lib/copilot/ai/registry";
import { parseCopilotIntent } from "@/lib/copilot/intent";
import {
  createCopilotDataLoader,
  createRecordedCopilotProvider,
  isCopilotQuotaFailure,
  RECORDED_CATALOGUE_NOTE,
  type CopilotDataLoader,
} from "@/lib/copilot/load";
import { fixtureExternalId, resolveFixtureFromQuery } from "@/lib/copilot/resolve-match";
import { matchLabelFromSnapshot, snapshotFromMatchCenter } from "@/lib/copilot/snapshot";
import type {
  CopilotAskInput,
  CopilotBriefing,
  CopilotIntent,
  CopilotMatchSnapshot,
  CopilotReply,
} from "@/lib/copilot/types";
import { matchLabel } from "@/lib/bankroll/match-search";
import { expectedValue } from "@/lib/copilot/pricing";
import type { DashboardMatchSummary } from "@/lib/dashboard/types";

const HELP_TEXT =
  "I am APEX Copilot, the desk analyst. I read APEX match files — who to back, why, what worries me, and whether to wait for the live market. I do not invent data the catalogue does not publish. Try: “Analyse Arsenal vs Chelsea” or “Who has the most value today?”.";

async function maybeRewriteExecutive(
  briefing: CopilotBriefing,
  snapshot: CopilotMatchSnapshot,
  ai: CopilotAiClient,
): Promise<CopilotBriefing> {
  if (ai.id === "local" || !ai.isAvailable()) return briefing;
  const executive = briefing.sections.find((section) => section.id === "executive");
  if (!executive) return briefing;
  try {
    const result = await ai.complete({
      system:
        "You are a professional football analyst for APEX. Rewrite ONLY the executive paragraph. Do not invent figures, injuries, or prices. Do not mention formulas or engine names. Use only the JSON facts.",
      user: JSON.stringify({
        facts: {
          home: snapshot.home.name,
          away: snapshot.away.name,
          call: briefing.intelligence.call,
          confidence: briefing.intelligence.confidenceBand,
          risk: briefing.intelligence.riskBand,
          value: briefing.intelligence.evTone,
          paragraph: briefing.intelligence.paragraph,
        },
      }),
    });
    const text = result.text.trim();
    if (!text) return briefing;
    return {
      ...briefing,
      modelId: result.providerId,
      intelligence: { ...briefing.intelligence, paragraph: text },
      sections: briefing.sections.map((section) =>
        section.id === "executive" ? { ...section, body: text } : section,
      ),
    };
  } catch {
    return briefing;
  }
}

export type CopilotServiceOptions = {
  loader?: CopilotDataLoader;
  ai?: CopilotAiClient;
};

export class CopilotService {
  private readonly loader: CopilotDataLoader;
  private readonly ai: CopilotAiClient;

  constructor(options: CopilotServiceOptions = {}) {
    this.loader = options.loader ?? createCopilotDataLoader();
    this.ai = options.ai ?? createCopilotAiClient();
  }

  async ask(input: CopilotAskInput): Promise<CopilotReply> {
    const intent = parseCopilotIntent(input.prompt);
    if (intent.kind === "help") {
      return {
        content: HELP_TEXT,
        intent: intent.kind,
        providerId: this.ai.id,
      };
    }

    try {
      return await this.runAsk(this.loader, intent);
    } catch (error) {
      if (!isCopilotQuotaFailure(error)) throw error;
      const recorded = createCopilotDataLoader({
        provider: createRecordedCopilotProvider(),
        env: {},
      });
      const reply = await this.runAsk(recorded, intent);
      return {
        ...reply,
        content: `${RECORDED_CATALOGUE_NOTE}\n\n${reply.content}`,
      };
    }
  }

  private async runAsk(
    loader: CopilotDataLoader,
    intent: CopilotIntent,
  ): Promise<CopilotReply> {
    const fixtures = await loader.listFixtures();
    if (fixtures.length === 0) {
      return {
        content:
          "There are no fixtures in the APEX catalogue right now. I will not analyse a match that is not on the board.",
        intent: intent.kind,
        providerId: this.ai.id,
      };
    }

    if (intent.kind === "value_scan") {
      return this.valueScan(loader, fixtures, intent.kind);
    }

    const search = intent.teamQuery ?? intent.query;
    const named = resolveFixtureFromQuery(fixtures, search);
    const picked =
      named ??
      (intent.teamQuery
        ? null
        : fixtures[0]!);

    if (!picked) {
      const available = fixtures
        .slice(0, 6)
        .map((fixture) => matchLabel(fixture))
        .join("; ");
      return {
        content: `There is no APEX fixture matching “${intent.teamQuery}”. On the board: ${available}. I will not analyse a match that is not published.`,
        intent: intent.kind,
        providerId: this.ai.id,
      };
    }
    const id = fixtureExternalId(picked);
    if (!id) {
      return {
        content: `I found ${matchLabel(picked)} but it has no provider id, so the analysis cannot be loaded.`,
        intent: intent.kind,
        providerId: this.ai.id,
      };
    }

    const match = await loader.loadMatch(id);
    const snapshot = snapshotFromMatchCenter(match);
    let briefing = buildLocalBriefing(snapshot, this.ai.id);
    briefing = await maybeRewriteExecutive(briefing, snapshot, this.ai);

    return {
      content:
        intent.kind === "stake_advice"
          ? `The suggested stake is ${briefing.stake.label}. ${briefingToChatText(briefing)}`
          : briefingToChatText(briefing),
      card: { kind: "briefing", briefing },
      intent: intent.kind,
      providerId: briefing.modelId,
    };
  }

  private async valueScan(
    loader: CopilotDataLoader,
    fixtures: DashboardMatchSummary[],
    intent: CopilotReply["intent"],
  ): Promise<CopilotReply> {
    const sample = fixtures.slice(0, 8);
    let best: {
      fixture: DashboardMatchSummary;
      snapshot: CopilotMatchSnapshot;
      ev: number;
      label: string;
    } | null = null;
    let quotaHit = false;

    for (const fixture of sample) {
      const id = fixtureExternalId(fixture);
      if (!id) continue;
      try {
        const match = await loader.loadMatch(id);
        const snapshot = snapshotFromMatchCenter(match);
        for (const row of snapshot.markets) {
          const ev = row.expectedValue ?? expectedValue(row.modelProbability ?? 0, row.decimalOdds);
          if (ev == null) continue;
          if (!best || ev > best.ev) {
            best = {
              fixture,
              snapshot,
              ev,
              label: `${row.market} ${row.label}`,
            };
          }
        }
      } catch (error) {
        if (isCopilotQuotaFailure(error)) quotaHit = true;
        continue;
      }
    }

    if (!best) {
      const first = fixtures[0]!;
      const id = fixtureExternalId(first);
      if (!id) {
        return {
          content:
            "The catalogue does not publish priced edges. Without a market there is no value scan.",
          intent,
          providerId: this.ai.id,
        };
      }
      if (quotaHit) {
        throw new Error(RECORDED_CATALOGUE_NOTE);
      }
      const match = await loader.loadMatch(id);
      const snapshot = snapshotFromMatchCenter(match);
      const briefing = buildLocalBriefing(snapshot, this.ai.id);
      return {
        content: `No priced edge showed up in this sample. Here is the first catalogue match: ${briefing.matchLabel}.`,
        card: { kind: "briefing", briefing },
        intent,
        providerId: briefing.modelId,
      };
    }

    const briefing = buildLocalBriefing(best.snapshot, this.ai.id);
    return {
      content: `The most interesting published price in this sample is ${matchLabelFromSnapshot(best.snapshot)} — ${best.label}.`,
      card: { kind: "briefing", briefing },
      intent,
      providerId: briefing.modelId,
    };
  }
}

export function createCopilotService(options?: CopilotServiceOptions): CopilotService {
  return new CopilotService(options);
}

export { HELP_TEXT };

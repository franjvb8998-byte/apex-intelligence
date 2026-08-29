/**
 * Local football analyst — Copilot Intelligence v1 from a published snapshot.
 * Never invents stats, injuries, or prices. Does not re-score the Decision Engine.
 */

import { buildCopilotIntelligence } from "@/lib/copilot/intelligence";
import { matchLabelFromSnapshot } from "@/lib/copilot/snapshot";
import { suggestedStake } from "@/lib/copilot/stake";
import type {
  CopilotBriefing,
  CopilotBriefingSection,
  CopilotMatchSnapshot,
} from "@/lib/copilot/types";

export function buildLocalBriefing(
  snapshot: CopilotMatchSnapshot,
  modelId = "local",
): CopilotBriefing {
  const matchLabel = matchLabelFromSnapshot(snapshot);
  const stake = suggestedStake(snapshot);
  const intelligence = buildCopilotIntelligence(snapshot);

  const sections: CopilotBriefingSection[] = [
    {
      id: "executive",
      title: "Executive Briefing",
      body: intelligence.paragraph,
    },
    {
      id: "strengths",
      title: "Why",
      body: "Why APEX likes this side.",
      bullets: intelligence.reasons.map((row) => row.title),
    },
    {
      id: "weaknesses",
      title: "Concerns",
      body: "What worries APEX.",
      bullets: intelligence.concerns.map((row) => row.title),
    },
  ];

  if (intelligence.live) {
    sections.push({
      id: "live",
      title: "Live Opportunity",
      body: "Potential live opportunity",
      bullets: intelligence.live.cues,
    });
  }

  sections.push(
    {
      id: "market",
      title: "Market Verdict",
      body: intelligence.verdict,
    },
    {
      id: "confidence",
      title: "Confidence",
      body: intelligence.confidenceWhy,
    },
  );

  return {
    matchLabel,
    league: snapshot.leagueName,
    generatedAt: new Date().toISOString(),
    analyst: "APEX Copilot",
    modelId,
    sections,
    stake,
    recommendationAction: snapshot.recommendation.action,
    confidenceBand: intelligence.confidenceBand,
    riskLevel: intelligence.riskBand,
    intelligence,
  };
}

export function briefingToChatText(briefing: CopilotBriefing): string {
  return briefing.intelligence.paragraph;
}

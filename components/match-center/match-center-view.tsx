"use client";

import { useEffect, useState } from "react";
import { AiMatchAnalysisPanel } from "@/components/match-center/ai-match-analysis-panel";
import { MatchCenterHeader } from "@/components/match-center/match-center-header";
import { PhaseTabs } from "@/components/match-center/phase-tabs";
import { PreviewPhase } from "@/components/match-center/preview-phase";
import { LivePhase } from "@/components/match-center/live-phase";
import { PostPhase } from "@/components/match-center/post-phase";
import { Card, CardHeader } from "@/components/design-system";
import type {
  MatchCenterData,
  MatchCenterPhase,
} from "@/lib/match-center/types";

type MatchCenterViewProps = {
  data: MatchCenterData;
  /** Override initial phase (defaults to data.defaultPhase). */
  initialPhase?: MatchCenterPhase;
};

/**
 * APEX Match Center™ — Preview + Live + Post Match in one shell.
 * Includes AI Match Analysis panel (Sprint 8).
 */
export function MatchCenterView({
  data,
  initialPhase,
}: MatchCenterViewProps) {
  const [phase, setPhase] = useState<MatchCenterPhase>(
    initialPhase ?? data.defaultPhase,
  );

  useEffect(() => {
    setPhase(initialPhase ?? data.defaultPhase);
  }, [data.match.matchId, data.defaultPhase, initialPhase]);

  return (
    <div className="w-full space-y-8">
      <MatchCenterHeader match={data.match} phase={phase} />
      <PhaseTabs active={phase} onChange={setPhase} />

      {phase === "preview" && <PreviewPhase data={data.preview} />}
      {phase === "live" && <LivePhase data={data.live} />}
      {phase === "post" && (
        <PostPhase
          data={data.post}
          homeShort={data.match.homeTeam.shortName}
          awayShort={data.match.awayTeam.shortName}
        />
      )}

      <Card padding="lg">
        <CardHeader
          title="AI Match Analysis"
          description="Data Platform · Probability Engine · Reasoning (reglas, sin LLM)."
        />
        <AiMatchAnalysisPanel analysis={data.aiAnalysis} />
      </Card>
    </div>
  );
}

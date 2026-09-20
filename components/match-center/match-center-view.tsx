"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { MatchProductLinks } from "@/components/app-shell/match-product-links";
import { AiMatchAnalysisPanel } from "@/components/match-center/ai-match-analysis-panel";
import { MatchCenterHeader } from "@/components/match-center/match-center-header";
import { PhaseTabs } from "@/components/match-center/phase-tabs";
import { PreviewPhase } from "@/components/match-center/preview-phase";
import { LivePhase } from "@/components/match-center/live-phase";
import { PostPhase } from "@/components/match-center/post-phase";
import { UnavailableDataCard } from "@/components/app-shell/states";
import { Card, CardHeader } from "@/components/design-system";
import type {
  MatchCenterData,
  MatchCenterPhase,
} from "@/lib/match-center/types";
import { isMatchCenterPostEvaluated } from "@/lib/match-center/post-evaluation";

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
  const t = useTranslations("matchCenter");
  const [phase, setPhase] = useState<MatchCenterPhase>(
    initialPhase ?? data.defaultPhase,
  );
  const phaseIdentity = `${data.match.matchId}:${initialPhase ?? data.defaultPhase}`;
  const [seenPhaseIdentity, setSeenPhaseIdentity] = useState(phaseIdentity);
  if (phaseIdentity !== seenPhaseIdentity) {
    setSeenPhaseIdentity(phaseIdentity);
    setPhase(initialPhase ?? data.defaultPhase);
  }

  return (
    <div className="w-full space-y-6">
      <MatchCenterHeader
        match={data.match}
        phase={phase}
        liveLite={data.liveLite === true}
      />
      <MatchProductLinks
        matchId={data.match.matchId}
        externalId={data.match.externalId}
        homeName={data.match.homeTeam.name}
        awayName={data.match.awayTeam.name}
        current="center"
      />
      <PhaseTabs active={phase} onChange={setPhase} />

      {phase === "preview" &&
        (data.liveLite || data.preview.probabilitiesAvailable === false ? (
          <UnavailableDataCard
            title={t("liveLitePrematchUnavailable")}
            description={t("liveLitePrematchUnavailableDescription")}
          />
        ) : (
          <PreviewPhase data={data.preview} match={data.match} />
        ))}
      {phase === "live" && <LivePhase data={data.live} />}
      {phase === "post" &&
        (isMatchCenterPostEvaluated(data.post) ? (
          <PostPhase
            data={data.post}
            homeShort={data.match.homeTeam.shortName}
            awayShort={data.match.awayTeam.shortName}
          />
        ) : (
          <UnavailableDataCard
            title={t("postEvaluationUnavailable")}
            description={t("postEvaluationUnavailableDescription")}
          />
        ))}

      <Card padding="lg">
        <CardHeader
          title={t("aiMatchAnalysis")}
          description={t("aiMatchAnalysisDescription")}
        />
        {data.liveLite ? (
          <UnavailableDataCard
            title={t("liveLiteAnalysisUnavailable")}
            description={t("liveLiteAnalysisUnavailableDescription")}
          />
        ) : (
          <AiMatchAnalysisPanel analysis={data.aiAnalysis} />
        )}
      </Card>
    </div>
  );
}

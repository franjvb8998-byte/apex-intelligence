"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { AiSidePanel } from "@/components/apex-vision/ai-side-panel";
import { MomentumBar } from "@/components/apex-vision/momentum-bar";
import { PitchField } from "@/components/apex-vision/pitch-field";
import { PressureIndicator } from "@/components/apex-vision/pressure-indicator";
import { VisionTimeline } from "@/components/apex-vision/vision-timeline";
import {
  Badge,
  Card,
} from "@/components/design-system";
import { UnavailableDataCard } from "@/components/app-shell/states";
import { LineupsCard, hasPublishedLineup } from "@/components/match-center/lineups-card";
import { simulateVisionTick } from "@/lib/apex-vision";
import type { MatchCenterLiveData } from "@/lib/match-center/types";
import type { VisionLiveState } from "@/lib/apex-vision/types";

const TICK_MS = 5000;

type LivePhaseProps = {
  data: MatchCenterLiveData;
};

/**
 * Live phase — reuses APEX Vision components.
 * Tick simulation is mock; replace with realtime feed later (`source`).
 */
export function LivePhase({ data }: LivePhaseProps) {
  const t = useTranslations("matchCenter");
  const vision = useTranslations("vision");
  const [state, setState] = useState<VisionLiveState>(data.vision);
  const [visionBaseline, setVisionBaseline] = useState(data.vision);

  if (data.vision !== visionBaseline) {
    setVisionBaseline(data.vision);
    setState(data.vision);
  }

  const lineups = data.lineups ?? { home: null, away: null };
  const showLineups =
    hasPublishedLineup(lineups.home) || hasPublishedLineup(lineups.away);

  useEffect(() => {
    if (data.source !== "mock") return;
    const id = window.setInterval(() => {
      setState((prev) => simulateVisionTick(prev));
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, [data.source]);

  return (
    <div className="space-y-6" role="tabpanel" aria-labelledby="match-center-tab-live">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={data.source === "mock" ? "info" : "danger"}>
            {data.source === "mock" ? t("livePreview") : "Live"}
          </Badge>
          <Badge tone="accent">APEX Vision</Badge>
        {data.source === "data-platform" && (
          <Badge>API-Football</Badge>
        )}
        </div>
        <Card padding="sm" className="min-w-[10rem] text-center">
          <p className="font-mono text-2xl font-bold tabular-nums text-white">
            {state.score.home} – {state.score.away}
          </p>
          <p className="mt-1 text-xs uppercase tracking-[var(--apex-tracking-wider)] text-[var(--apex-fg-subtle)]">
            {vision("minute", { minute: state.minute })}
          </p>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-5">
        <div className="space-y-4 xl:col-span-3">
          <PitchField
            players={state.players}
            ball={state.ball}
            homeShort={state.homeTeam.shortName}
            awayShort={state.awayTeam.shortName}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <MomentumBar
              value={state.momentum}
              homeLabel={state.homeTeam.shortName}
              awayLabel={state.awayTeam.shortName}
            />
            <PressureIndicator
              value={state.pressure}
              side={state.pressureSide}
              homeLabel={state.homeTeam.shortName}
              awayLabel={state.awayTeam.shortName}
            />
          </div>

          <UnavailableDataCard
            title={t("heatmapUnavailable")}
            description={t("heatmapUnavailableDescription")}
          />

          {showLineups && (
            <LineupsCard home={lineups.home} away={lineups.away} />
          )}

          <VisionTimeline
            events={state.events}
            homeShort={state.homeTeam.shortName}
            awayShort={state.awayTeam.shortName}
          />
        </div>

        <div className="xl:col-span-2">
          <AiSidePanel state={state} />
        </div>
      </div>
    </div>
  );
}

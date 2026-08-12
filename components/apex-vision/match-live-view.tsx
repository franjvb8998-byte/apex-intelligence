"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { AiSidePanel } from "@/components/apex-vision/ai-side-panel";
import { MomentumBar } from "@/components/apex-vision/momentum-bar";
import { PitchField } from "@/components/apex-vision/pitch-field";
import { PressureIndicator } from "@/components/apex-vision/pressure-indicator";
import { VisionTimeline } from "@/components/apex-vision/vision-timeline";
import {
  Badge,
  Card,
  HeatmapPlaceholder,
} from "@/components/design-system";
import {
  createInitialVisionState,
  simulateVisionTick,
  type VisionLiveState,
} from "@/lib/apex-vision";

const TICK_MS = 5000;

type MatchLiveViewProps = {
  /** Optional initial state for tests; defaults to mock seed. */
  initialState?: VisionLiveState;
};

/**
 * Immersive live match shell.
 * Simulation is client-only mock — replace tick with realtime later.
 */
export function MatchLiveView({ initialState }: MatchLiveViewProps) {
  const [state, setState] = useState<VisionLiveState>(
    () => initialState ?? createInitialVisionState(),
  );

  useEffect(() => {
    const id = window.setInterval(() => {
      setState((prev) => simulateVisionTick(prev));
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="w-full space-y-6">
      <motion.header
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"
      >
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Badge tone="accent">{state.leagueName}</Badge>
            <Badge tone="danger">EN VIVO</Badge>
            <Badge>Mock · {TICK_MS / 1000}s</Badge>
          </div>
          <h1 className="text-2xl font-bold text-white sm:text-3xl">
            {state.homeTeam.name}{" "}
            <span className="text-[var(--apex-fg-subtle)]">vs</span>{" "}
            {state.awayTeam.name}
          </h1>
          <p className="mt-1 text-sm text-[var(--apex-fg-muted)]">
            APEX Vision — seguimiento inmersivo
          </p>
        </div>

        <Card padding="sm" className="min-w-[11rem] text-center">
          <p className="font-mono text-3xl font-bold tabular-nums text-white">
            {state.score.home} – {state.score.away}
          </p>
          <p className="mt-1 text-xs uppercase tracking-[var(--apex-tracking-wider)] text-[var(--apex-fg-subtle)]">
            Minuto {state.minute}&apos;
          </p>
          <p className="mt-2 font-mono text-xs text-[var(--apex-accent)]">
            Posesión {Math.round(state.possessionHome)}% –{" "}
            {Math.round(100 - state.possessionHome)}%
          </p>
        </Card>
      </motion.header>

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

          <Card>
            <HeatmapPlaceholder
              title="Heatmap de actividad"
              description="Placeholder del Design System — listo para datos de zona reales."
            />
          </Card>

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

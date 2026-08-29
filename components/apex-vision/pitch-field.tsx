"use client";

import { BallMarker } from "@/components/apex-vision/ball-marker";
import { PlayerMarkers } from "@/components/apex-vision/player-markers";
import { Card } from "@/components/design-system";
import { useTranslations } from "next-intl";
import type { PitchPoint, VisionPlayer } from "@/lib/apex-vision/types";

type PitchFieldProps = {
  players: VisionPlayer[];
  ball: PitchPoint;
  homeShort: string;
  awayShort: string;
};

/**
 * Responsive 2D pitch. Coordinates are percentages (0–100).
 */
export function PitchField({
  players,
  ball,
  homeShort,
  awayShort,
}: PitchFieldProps) {
  const t = useTranslations("vision");
  return (
    <Card padding="sm" className="overflow-hidden" aria-label={t("pitchAria")}>
      <div className="mb-3 flex items-center justify-between px-1 text-xs text-[var(--apex-fg-subtle)]">
        <span className="font-semibold text-[var(--apex-accent)]">{homeShort}</span>
        <span>{t("pitch2d")}</span>
        <span className="font-semibold text-sky-400">{awayShort}</span>
      </div>

      <div className="relative aspect-[16/10] w-full overflow-hidden rounded-[var(--apex-radius-xl)] border border-emerald-800/40 bg-[#14532d]">
        {/* Grass stripes */}
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              "repeating-linear-gradient(90deg, transparent 0, transparent 12.5%, rgba(0,0,0,0.18) 12.5%, rgba(0,0,0,0.18) 25%)",
          }}
          aria-hidden
        />

        {/* Touchlines */}
        <div className="absolute inset-[3%] rounded-sm border-2 border-white/70" aria-hidden />

        {/* Halfway */}
        <div className="absolute top-[3%] bottom-[3%] left-1/2 w-0.5 -translate-x-1/2 bg-white/70" aria-hidden />
        <div className="absolute left-1/2 top-1/2 h-[18%] w-[11%] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/70" aria-hidden />
        <div className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/80" aria-hidden />

        {/* Penalty boxes */}
        <div className="absolute top-[22%] bottom-[22%] left-[3%] w-[14%] border-2 border-l-0 border-white/70" aria-hidden />
        <div className="absolute top-[22%] bottom-[22%] right-[3%] w-[14%] border-2 border-r-0 border-white/70" aria-hidden />
        <div className="absolute top-[35%] bottom-[35%] left-[3%] w-[6%] border-2 border-l-0 border-white/60" aria-hidden />
        <div className="absolute top-[35%] bottom-[35%] right-[3%] w-[6%] border-2 border-r-0 border-white/60" aria-hidden />

        <PlayerMarkers players={players} />
        <BallMarker position={ball} />
      </div>
    </Card>
  );
}

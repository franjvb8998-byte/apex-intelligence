"use client";

import { motion } from "framer-motion";
import { cx } from "@/components/design-system";
import type { VisionPlayer } from "@/lib/apex-vision/types";

type PlayerMarkersProps = {
  players: VisionPlayer[];
  schematic?: boolean;
};

export function PlayerMarkers({ players, schematic = false }: PlayerMarkersProps) {
  return (
    <>
      {players.map((player, index) => {
        const isHome = player.side === "home";
        const label = schematic
          ? `Schematic formation ${player.side} ${player.number} ${player.name}`
          : `${player.side} ${player.number} ${player.name}`;
        return (
          <motion.div
            key={`${player.side}:${index}:${player.id}`}
            className="absolute z-10 -translate-x-1/2 -translate-y-1/2"
            initial={false}
            animate={{ left: `${player.position.x}%`, top: `${player.position.y}%` }}
            transition={
              schematic
                ? { duration: 0 }
                : { type: "spring", stiffness: 90, damping: 18, mass: 0.7 }
            }
            title={label}
          >
            <div
              className={cx(
                "flex h-7 w-7 items-center justify-center rounded-full border text-[10px] font-bold shadow-md sm:h-8 sm:w-8 sm:text-xs",
                isHome
                  ? "border-[var(--apex-accent-border)] bg-[var(--apex-accent)] text-[var(--apex-fg-inverse)]"
                  : "border-sky-400/50 bg-sky-500/90 text-white",
              )}
              aria-label={label}
            >
              {player.number}
            </div>
          </motion.div>
        );
      })}
    </>
  );
}

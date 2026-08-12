"use client";

import { motion } from "framer-motion";
import type { PitchPoint } from "@/lib/apex-vision/types";

type BallMarkerProps = {
  position: PitchPoint;
};

export function BallMarker({ position }: BallMarkerProps) {
  return (
    <motion.div
      className="absolute z-20 -translate-x-1/2 -translate-y-1/2"
      initial={false}
      animate={{ left: `${position.x}%`, top: `${position.y}%` }}
      transition={{ type: "spring", stiffness: 120, damping: 16 }}
      aria-label="Balón"
    >
      <motion.div
        className="h-3.5 w-3.5 rounded-full bg-white shadow-[0_0_12px_rgba(255,255,255,0.55)] sm:h-4 sm:w-4"
        animate={{ scale: [1, 1.12, 1] }}
        transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
      />
    </motion.div>
  );
}

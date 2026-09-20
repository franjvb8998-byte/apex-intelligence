"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { pageTransitionEnterInitial } from "@/components/app-shell/page-transition-enter";

type PageTransitionProps = {
  children: ReactNode;
};

/**
 * Page wrapper. `initial` is always the animate snapshot so SSR and the
 * first client paint match. `useReducedMotion()` is null on the server and
 * boolean on the client — using it to pick `{ opacity: 0, y: 8 }` caused
 * the Match Center hydration overlay.
 */
export function PageTransition({ children }: PageTransitionProps) {
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      key={pathname}
      initial={pageTransitionEnterInitial({
        allowEnterAnimation: false,
        reduceMotion,
      })}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: reduceMotion ? 0 : 0.28,
        ease: [0.16, 1, 0.3, 1],
      }}
      className="min-h-0 flex-1"
    >
      {children}
    </motion.div>
  );
}

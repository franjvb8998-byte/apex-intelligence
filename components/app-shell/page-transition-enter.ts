/**
 * Framer Motion enter payload for AppShell page transitions.
 *
 * `useReducedMotion()` is `null` during SSR / first paint and a boolean on
 * the client. Choosing `initial={{ opacity: 0, y: 8 }}` from that hook
 * produced a hydration mismatch (server opacity 1 vs client opacity 0).
 *
 * First paint (SSR + hydrate) must use `initial={false}` so styles match.
 * Client route changes may animate only after hydration, and only when the
 * user has not requested reduced motion.
 */
export type PageTransitionEnterInitial = false | { opacity: number; y: number };

export function pageTransitionEnterInitial(input: {
  allowEnterAnimation: boolean;
  reduceMotion: boolean | null;
}): PageTransitionEnterInitial {
  if (!input.allowEnterAnimation) return false;
  if (input.reduceMotion !== false) return false;
  return { opacity: 0, y: 8 };
}

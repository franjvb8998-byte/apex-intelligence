"use client";

import { AppErrorFallback } from "@/components/app-shell/app-error-fallback";

export default function MatchCenterError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <AppErrorFallback error={error} reset={reset} />;
}

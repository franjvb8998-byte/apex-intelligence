"use client";

import { AppErrorFallback } from "@/components/app-shell/app-error-fallback";

export default function BankrollError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <AppErrorFallback error={error} reset={reset} />;
}

"use client";

import { AppErrorFallback } from "@/components/app-shell/app-error-fallback";
import "./globals.css";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="es">
      <body className="min-h-full bg-[var(--apex-bg,#0b1220)] text-[var(--apex-fg,#e2e8f0)]">
        <AppErrorFallback error={error} reset={reset} />
      </body>
    </html>
  );
}

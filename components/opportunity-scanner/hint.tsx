"use client";

import type { ReactNode } from "react";

export function ScannerHint({
  hint,
  children,
}: {
  hint: string;
  children: ReactNode;
}) {
  return (
    <span className="apex-scanner-hint">
      {children}
      <span
        role="tooltip"
        className="pointer-events-none invisible absolute bottom-full left-1/2 z-30 mb-2 w-56 -translate-x-1/2 rounded-[var(--apex-radius-md)] border border-[var(--apex-accent-border)] bg-[#0b1220] px-3 py-2 text-left text-xs font-normal normal-case leading-relaxed tracking-normal text-[var(--apex-fg)] opacity-0 shadow-[var(--apex-shadow-sm)]"
      >
        {hint}
      </span>
    </span>
  );
}

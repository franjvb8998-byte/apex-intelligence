"use client";

import type { Ref } from "react";
import { formatDecimalField } from "@/lib/bankroll/form";

const inputClass =
  "apex-focusable h-12 w-full min-w-0 rounded-[var(--apex-radius-md)] border border-[var(--apex-border)] bg-slate-950/50 px-3 font-mono text-sm tabular-nums text-[var(--apex-fg)] outline-none placeholder:text-[var(--apex-fg-subtle)] transition-colors focus:border-[var(--apex-accent-border)]";

type DecimalFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  inputRef?: Ref<HTMLInputElement>;
  digits?: number;
};

export function DecimalField({
  label,
  value,
  onChange,
  inputRef,
  digits = 2,
}: DecimalFieldProps) {
  return (
    <label className="block min-w-0 space-y-1.5">
      <span className="text-xs font-medium uppercase tracking-[var(--apex-tracking-wider)] text-[var(--apex-fg-subtle)]">
        {label}
      </span>
      <input
        ref={inputRef}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        spellCheck={false}
        value={value}
        onFocus={(event) => event.currentTarget.select()}
        onChange={(event) => {
          onChange(event.target.value.replace(/[^\d.,]/g, ""));
        }}
        onBlur={() => onChange(formatDecimalField(value, digits))}
        className={inputClass}
      />
    </label>
  );
}

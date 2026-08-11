import type { InputHTMLAttributes } from "react";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
};

export function Input({ label, error, id, className = "", ...props }: InputProps) {
  const inputId = id ?? props.name;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-sm font-medium text-slate-300">
        {label}
      </label>
      <input
        id={inputId}
        className={`h-12 w-full rounded-xl border bg-slate-900/60 px-4 text-white placeholder:text-slate-500 outline-none transition-colors focus:border-[#00D4AA]/50 focus:ring-2 focus:ring-[#00D4AA]/20 ${
          error
            ? "border-red-500/60 focus:border-red-500/60 focus:ring-red-500/20"
            : "border-slate-700"
        } ${className}`}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${inputId}-error` : undefined}
        {...props}
      />
      {error && (
        <p id={`${inputId}-error`} className="text-sm text-red-400" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

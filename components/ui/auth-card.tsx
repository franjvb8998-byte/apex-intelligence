import type { ReactNode } from "react";

type AuthCardProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
};

export function AuthCard({ title, subtitle, children, footer }: AuthCardProps) {
  return (
    <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/50 p-8 backdrop-blur-sm shadow-lg shadow-black/20">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-2 text-sm text-slate-400 sm:text-base">{subtitle}</p>
        )}
      </div>

      {children}

      {footer && (
        <div className="mt-6 border-t border-slate-800 pt-6 text-center text-sm text-slate-400">
          {footer}
        </div>
      )}
    </div>
  );
}

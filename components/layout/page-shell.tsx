import type { ReactNode } from "react";
import { BackgroundDecorations } from "@/components/ui/background-decorations";
import { Logo } from "@/components/ui/logo";

type PageShellProps = {
  children: ReactNode;
  centered?: boolean;
  showFooter?: boolean;
};

export function PageShell({
  children,
  centered = false,
  showFooter = true,
}: PageShellProps) {
  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-[#0B1220] text-slate-100">
      <BackgroundDecorations />

      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6 sm:px-8">
        <Logo />
      </header>

      <main
        className={`relative z-10 mx-auto flex w-full max-w-6xl flex-1 px-6 sm:px-8 ${
          centered
            ? "items-center justify-center py-12"
            : "pb-24 pt-12 sm:pt-20"
        }`}
      >
        {children}
      </main>

      {showFooter && (
        <footer className="relative z-10 border-t border-slate-800/60 py-8 text-center text-sm text-slate-500">
          <p>
            © {new Date().getFullYear()}{" "}
            <span className="text-[#00D4AA]">APEX</span> Intelligence. Todos los
            derechos reservados.
          </p>
        </footer>
      )}
    </div>
  );
}

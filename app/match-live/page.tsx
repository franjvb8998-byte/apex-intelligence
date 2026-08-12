import type { Metadata } from "next";
import Link from "next/link";
import { MatchLiveView } from "@/components/apex-vision";
import { PageShell } from "@/components/layout/page-shell";

export const metadata: Metadata = {
  title: "APEX Vision — Match Live",
  description:
    "Seguimiento inmersivo de partidos con campo 2D, momentum y panel de IA.",
};

export default function MatchLivePage() {
  return (
    <PageShell>
      <div className="w-full">
        <p className="mb-6 text-sm text-[var(--apex-fg-subtle)]">
          <Link
            href="/dashboard"
            className="transition-colors hover:text-[var(--apex-accent)]"
          >
            Dashboard
          </Link>
          <span className="mx-2">/</span>
          <span className="text-slate-300">APEX Vision</span>
        </p>
        <MatchLiveView />
      </div>
    </PageShell>
  );
}

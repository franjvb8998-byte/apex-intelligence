import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { PageShell } from "@/components/layout/page-shell";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Dashboard — APEX Intelligence",
  description: "Tu panel de análisis deportivo.",
};

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const displayName =
    (user.user_metadata?.full_name as string | undefined)?.trim() ||
    user.email?.split("@")[0] ||
    "Usuario";

  return (
    <PageShell>
      <div className="w-full max-w-3xl">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-[#00D4AA]">Panel protegido</p>
            <h1 className="mt-2 text-3xl font-bold text-white sm:text-4xl">
              Hola, {displayName}
            </h1>
            <p className="mt-2 text-slate-400">{user.email}</p>
          </div>
          <SignOutButton />
        </div>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 backdrop-blur-sm">
          <h2 className="text-lg font-semibold text-white">
            Dashboard Inteligente
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-400">
            Has iniciado sesión correctamente. Aquí podrás visualizar tu
            rendimiento, métricas y análisis deportivo.
          </p>
          <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:gap-4">
            <Link
              href="/match-analysis"
              className="inline-flex text-sm font-medium text-[#00D4AA] transition-colors hover:text-[#00eabb]"
            >
              Ver Match Analysis (demo) →
            </Link>
            <Link
              href="/match-live"
              className="inline-flex text-sm font-medium text-[#00D4AA] transition-colors hover:text-[#00eabb]"
            >
              Abrir APEX Vision (live) →
            </Link>
          </div>
        </section>
      </div>
    </PageShell>
  );
}

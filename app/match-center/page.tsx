import type { Metadata } from "next";
import { ProductShell } from "@/components/app-shell/product-shell";
import { DashboardMatchList } from "@/components/dashboard";
import { MatchCenterView } from "@/components/match-center";
import { getShellUser } from "@/lib/auth/get-shell-user";
import { getMatchCenterData } from "@/lib/match-center";

export const metadata: Metadata = {
  title: "APEX Match Center™ — APEX Intelligence",
  description:
    "Dashboard de partido: probabilidad, EV, xG, BTTS, forma, H2H y recomendación.",
};

type MatchCenterPageProps = {
  searchParams: Promise<{ matchId?: string | string[] }>;
};

export default async function MatchCenterPage({
  searchParams,
}: MatchCenterPageProps) {
  const params = await searchParams;
  const raw = params.matchId;
  const matchId = Array.isArray(raw) ? raw[0] : raw;

  const [data, user] = await Promise.all([
    getMatchCenterData({
      externalMatchId: matchId || undefined,
      requireProvider: true,
    }),
    getShellUser(),
  ]);

  return (
    <ProductShell user={user}>
      <div className="w-full space-y-8">
        <DashboardMatchList
          title="Partidos"
          description="Fixtures de hoy (UTC). Si no hay partidos, Premier League 2025."
          matches={data.fixtures}
          emptyLabel="API-Football no devolvió fixtures para hoy ni Premier League 2025."
        />
        <MatchCenterView data={data} initialPhase="preview" />
      </div>
    </ProductShell>
  );
}

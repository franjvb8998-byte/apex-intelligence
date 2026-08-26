import type { Metadata } from "next";
import { ProductShell } from "@/components/app-shell/product-shell";
import { MatchAnalysisView } from "@/components/match-analysis";
import { getShellUser } from "@/lib/auth/get-shell-user";
import { getMockMatchAnalysis } from "@/lib/match-analysis";

export const metadata: Metadata = {
  title: "Match Analysis — APEX Intelligence",
  description:
    "Probabilidades 1X2, mercados, APEX Score y explicación del modelo.",
};

export default async function MatchAnalysisPage() {
  const user = await getShellUser();
  const data = getMockMatchAnalysis();

  return (
    <ProductShell user={user}>
      <div className="w-full">
        <MatchAnalysisView data={data} />
      </div>
    </ProductShell>
  );
}

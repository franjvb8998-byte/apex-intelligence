import type { Metadata } from "next";
import { ProductShell } from "@/components/app-shell/product-shell";
import { MatchCenterView } from "@/components/match-center";
import { getShellUser } from "@/lib/auth/get-shell-user";
import { getMatchCenterData } from "@/lib/match-center";

export const metadata: Metadata = {
  title: "APEX Match Center™ — APEX Intelligence",
  description:
    "Preview, Live y Post Match en una sola experiencia de decisión.",
};

export default async function MatchCenterPage() {
  const [data, user] = await Promise.all([
    getMatchCenterData({ requireProvider: true }),
    getShellUser(),
  ]);

  return (
    <ProductShell user={user}>
      <div className="w-full">
        <MatchCenterView data={data} />
      </div>
    </ProductShell>
  );
}

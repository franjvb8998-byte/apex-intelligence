import type { Metadata } from "next";
import { ProductShell } from "@/components/app-shell/product-shell";
import { MatchLiveView } from "@/components/apex-vision";
import { getShellUser } from "@/lib/auth/get-shell-user";

export const metadata: Metadata = {
  title: "APEX Vision — Match Live",
  description:
    "Seguimiento inmersivo de partidos con campo 2D, momentum y panel de IA.",
};

export default async function MatchLivePage() {
  const user = await getShellUser();

  return (
    <ProductShell user={user}>
      <div className="w-full">
        <MatchLiveView />
      </div>
    </ProductShell>
  );
}

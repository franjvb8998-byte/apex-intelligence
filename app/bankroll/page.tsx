import type { Metadata } from "next";
import { ProductShell } from "@/components/app-shell/product-shell";
import { BankrollView } from "@/components/bankroll";
import { getShellUser } from "@/lib/auth/get-shell-user";
import { getMockBankroll } from "@/lib/bankroll";
import { loadBankrollFixtures } from "@/lib/bankroll/load-fixtures";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "My Bankroll — APEX Intelligence",
  description:
    "Bankroll actual, ROI, yield, historial de apuestas y evolución del saldo.",
};

export default async function BankrollPage() {
  const user = await getShellUser();
  const data = getMockBankroll();
  const fixtures = await loadBankrollFixtures();

  return (
    <ProductShell user={user}>
      <BankrollView initial={data} fixtures={fixtures} />
    </ProductShell>
  );
}

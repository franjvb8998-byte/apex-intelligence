import { getTranslations } from "next-intl/server";
import { ProductShell } from "@/components/app-shell/product-shell";
import { ChatWindow } from "@/components/copilot";
import { getShellUser } from "@/lib/auth/get-shell-user";
import { createCopilotDataLoader } from "@/lib/copilot";
import { matchLabel } from "@/lib/bankroll/match-search";
import { localeMetadata } from "@/lib/i18n/page-meta";
import { firstSearchParam, matchesFixtureId } from "@/lib/match-center/fixture-id";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return localeMetadata("copilot");
}

type CopilotPageProps = {
  searchParams: Promise<{
    prompt?: string | string[];
    fixture?: string | string[];
  }>;
};

export default async function CopilotPage({ searchParams }: CopilotPageProps) {
  const [user, t, fixtures, params] = await Promise.all([
    getShellUser(),
    getTranslations("copilot"),
    createCopilotDataLoader()
      .listFixtures()
      .catch(() => []),
    searchParams,
  ]);
  const first = fixtures[0];
  const label = first ? matchLabel(first) : t("catalogueMatch");
  const prompts = [
    t("promptAnalyze", { match: label }),
    t("promptValue"),
    t("promptExplain", { match: label }),
    t("promptStake"),
    t("promptResume", { match: label }),
  ];
  const fromPrompt = firstSearchParam(params.prompt);
  const fromFixture = firstSearchParam(params.fixture);
  const match = fromFixture
    ? fixtures.find((item) => matchesFixtureId(item, fromFixture))
    : undefined;
  const initialPrompt =
    fromPrompt ??
    (match
      ? t("promptAnalyze", { match: matchLabel(match) })
      : undefined);

  return (
    <ProductShell user={user}>
      <ChatWindow embedded prompts={prompts} initialPrompt={initialPrompt} />
    </ProductShell>
  );
}

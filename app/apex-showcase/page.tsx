import { getTranslations } from "next-intl/server";
import { GuestShell } from "@/components/app-shell/guest-shell";
import { ApexShowcaseView } from "@/components/apex-showcase";
import { Badge } from "@/components/design-system";
import { localeMetadata } from "@/lib/i18n/page-meta";

export async function generateMetadata() {
  return {
    ...(await localeMetadata("showcase")),
    robots: {
      index: false,
      follow: false,
    },
  };
}

/**
 * Internal platform showcase — UI only.
 * No Supabase server / next/headers imports.
 */
export default async function ApexShowcasePage() {
  const t = await getTranslations("showcase");
  return (
    <GuestShell>
      <div className="w-full space-y-6">
        <Badge tone="accent">{t("internalOnly")}</Badge>
        <ApexShowcaseView />
      </div>
    </GuestShell>
  );
}

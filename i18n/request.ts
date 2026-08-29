import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { LOCALE_COOKIE } from "@/lib/i18n/config";
import { negotiateLocale } from "@/lib/i18n/negotiate";
import en from "../messages/en.json";
import es from "../messages/es.json";

const catalogs = { en, es } as const;

export default getRequestConfig(async () => {
  const store = await cookies();
  const headerStore = await headers();
  const locale = negotiateLocale(
    store.get(LOCALE_COOKIE)?.value,
    headerStore.get("accept-language"),
  );

  return {
    locale,
    messages: catalogs[locale],
  };
});

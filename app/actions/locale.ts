"use server";

import { cookies } from "next/headers";
import {
  LOCALE_COOKIE,
  LOCALE_COOKIE_MAX_AGE,
  isLocale,
  type Locale,
} from "@/lib/i18n/config";

export async function setAppLocale(locale: Locale) {
  if (!isLocale(locale)) return;
  const store = await cookies();
  store.set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: LOCALE_COOKIE_MAX_AGE,
    sameSite: "lax",
  });
}

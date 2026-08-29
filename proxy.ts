import type { NextRequest } from "next/server";
import {
  LOCALE_COOKIE,
  LOCALE_COOKIE_MAX_AGE,
} from "@/lib/i18n/config";
import { negotiateLocale } from "@/lib/i18n/negotiate";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  const response = await updateSession(request);
  if (!request.cookies.get(LOCALE_COOKIE)?.value) {
    const locale = negotiateLocale(
      undefined,
      request.headers.get("accept-language"),
    );
    response.cookies.set(LOCALE_COOKIE, locale, {
      path: "/",
      maxAge: LOCALE_COOKIE_MAX_AGE,
      sameSite: "lax",
    });
  }
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

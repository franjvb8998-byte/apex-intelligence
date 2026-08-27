import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  AUTH_CALLBACK_PATH,
  AUTH_CONFIRM_PATH,
  getNextPathForAuthCode,
} from "@/lib/auth/password-recovery";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase/env";
import { getUserFast } from "@/lib/supabase/get-user-fast";

function isPublicAuthRoute(pathname: string) {
  return (
    pathname === "/login" ||
    pathname === "/register" ||
    pathname === "/forgot-password" ||
    pathname === "/reset-password" ||
    pathname.startsWith("/auth/")
  );
}

export async function updateSession(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");

  if (code && pathname !== AUTH_CALLBACK_PATH) {
    const url = request.nextUrl.clone();
    url.pathname = AUTH_CALLBACK_PATH;
    url.searchParams.set("next", getNextPathForAuthCode(pathname, type));
    return NextResponse.redirect(url);
  }

  if (
    tokenHash &&
    type &&
    pathname !== AUTH_CONFIRM_PATH &&
    pathname !== AUTH_CALLBACK_PATH
  ) {
    const url = request.nextUrl.clone();
    url.pathname = AUTH_CONFIRM_PATH;
    if (type === "recovery") {
      url.searchParams.set("next", "/reset-password");
    }
    return NextResponse.redirect(url);
  }

  let supabaseResponse = NextResponse.next({ request });

  // /login must never wait on supabase.auth.getUser() (network).
  // That call was blocking the response indefinitely when Auth was slow/unreachable.
  if (isPublicAuthRoute(pathname)) {
    return supabaseResponse;
  }

  const supabase = createServerClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );
        Object.entries(headers).forEach(([key, value]) =>
          supabaseResponse.headers.set(key, value),
        );
      },
    },
  });

  const {
    data: { user },
  } = await getUserFast(supabase);

  if (!user && pathname.startsWith("/dashboard")) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const RESET_PASSWORD_PATH = "/reset-password";
export const AUTH_CALLBACK_PATH = "/auth/callback";
export const AUTH_CONFIRM_PATH = "/auth/confirm";

type LocationLike = {
  pathname: string;
  search: string;
  hash: string;
};

export function getPasswordResetEmailRedirectTo(origin: string): string {
  return `${origin}${RESET_PASSWORD_PATH}`;
}

export function sanitizeNextPath(
  next: string | null | undefined,
  fallback = "/dashboard",
): string {
  if (
    !next ||
    !next.startsWith("/") ||
    next.startsWith("//") ||
    next.includes("\\")
  ) {
    return fallback;
  }

  return next;
}

export function getNextPathForAuthCode(
  pathname: string,
  type: string | null = null,
): string {
  if (
    pathname === "/" ||
    pathname === RESET_PASSWORD_PATH ||
    pathname === "/forgot-password" ||
    type === "recovery"
  ) {
    return RESET_PASSWORD_PATH;
  }

  return sanitizeNextPath(pathname, RESET_PASSWORD_PATH);
}

export function getPasswordRecoveryRedirectPath(
  location: LocationLike,
): string | null {
  if (
    location.pathname === AUTH_CALLBACK_PATH ||
    location.pathname === AUTH_CONFIRM_PATH
  ) {
    return null;
  }

  const hashParams = new URLSearchParams(location.hash.replace(/^#/, ""));
  const searchParams = new URLSearchParams(location.search.replace(/^\?/, ""));
  const type = hashParams.get("type") ?? searchParams.get("type");
  const tokenHash = searchParams.get("token_hash") ?? searchParams.get("token");
  const code = searchParams.get("code");
  const accessToken =
    hashParams.get("access_token") ?? searchParams.get("access_token");

  if (tokenHash && type) {
    const nextParams = new URLSearchParams(searchParams);
    if (type === "recovery") nextParams.set("next", RESET_PASSWORD_PATH);
    return `${AUTH_CONFIRM_PATH}?${nextParams.toString()}`;
  }

  if (code && location.pathname !== AUTH_CALLBACK_PATH) {
    const next = getNextPathForAuthCode(location.pathname, type);
    const nextParams = new URLSearchParams();
    nextParams.set("code", code);
    nextParams.set("next", next);
    return `${AUTH_CALLBACK_PATH}?${nextParams.toString()}`;
  }

  if (type !== "recovery" && !accessToken) return null;

  if (type === "recovery" && location.pathname === RESET_PASSWORD_PATH) {
    return null;
  }

  if (type === "recovery" || (accessToken && type === "recovery")) {
    const combined = new URLSearchParams(hashParams);
    searchParams.forEach((value, key) => {
      if (key !== "code") combined.set(key, value);
    });
    const hash = combined.toString();
    return hash
      ? `${RESET_PASSWORD_PATH}#${hash}`
      : RESET_PASSWORD_PATH;
  }

  return null;
}

/**
 * Blocking (non-async) script. Keep in sync with getPasswordRecoveryRedirectPath.
 * Must not use next/script — that marks the tag async and paints the landing first.
 */
export const PASSWORD_RECOVERY_BOOTSTRAP_SCRIPT = `(function(){try{var path=window.location.pathname;if(path==="/auth/callback"||path==="/auth/confirm")return;var hash=(window.location.hash||"").replace(/^#/,"");var search=(window.location.search||"").replace(/^\\?/,"");var hp=new URLSearchParams(hash);var sp=new URLSearchParams(search);var type=hp.get("type")||sp.get("type");var tokenHash=sp.get("token_hash")||sp.get("token");var code=sp.get("code");var accessToken=hp.get("access_token")||sp.get("access_token");if(tokenHash&&type){if(type==="recovery")sp.set("next","/reset-password");window.location.replace("/auth/confirm?"+sp.toString());return;}if(code&&path!=="/auth/callback"){var next=(path==="/"||path==="/reset-password"||path==="/forgot-password"||type==="recovery")?"/reset-password":path;window.location.replace("/auth/callback?code="+encodeURIComponent(code)+"&next="+encodeURIComponent(next));return;}if(type!=="recovery")return;if(path==="/reset-password")return;var combined=new URLSearchParams(hash);sp.forEach(function(v,k){if(k!=="code")combined.set(k,v);});var h=combined.toString();window.location.replace(h?"/reset-password#"+h:"/reset-password");}catch(e){}})();`;

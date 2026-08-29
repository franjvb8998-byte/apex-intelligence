import {
  defaultLocale,
  isLocale,
  type Locale,
} from "@/lib/i18n/config";

/**
 * Cookie wins (user override). Otherwise Accept-Language, then English.
 */
export function negotiateLocale(
  cookieValue: string | undefined | null,
  acceptLanguage: string | undefined | null,
): Locale {
  if (isLocale(cookieValue)) return cookieValue;

  if (!acceptLanguage) return defaultLocale;

  const ranked = acceptLanguage
    .split(",")
    .map((part) => {
      const [tag, ...params] = part.trim().split(";");
      const q = params.find((param) => param.trim().startsWith("q="));
      const quality = q ? Number(q.trim().slice(2)) : 1;
      return { tag: (tag ?? "").trim().toLowerCase(), quality };
    })
    .filter((row) => row.tag.length > 0)
    .sort((a, b) => b.quality - a.quality);

  for (const { tag } of ranked) {
    if (tag === "en" || tag.startsWith("en-")) return "en";
    if (tag === "es" || tag.startsWith("es-")) return "es";
  }

  return defaultLocale;
}

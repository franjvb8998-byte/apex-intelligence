import { describe, expect, it } from "vitest";
import { negotiateLocale } from "@/lib/i18n/negotiate";

describe("locale negotiation", () => {
  it("prefers a saved user override over the browser", () => {
    expect(negotiateLocale("es", "en-US,en;q=0.9")).toBe("es");
    expect(negotiateLocale("en", "es-MX,es;q=0.9")).toBe("en");
  });

  it("detects Spanish and English from Accept-Language", () => {
    expect(negotiateLocale(undefined, "es-ES,es;q=0.9,en;q=0.8")).toBe("es");
    expect(negotiateLocale(undefined, "en-GB,en;q=0.9")).toBe("en");
  });

  it("defaults to English when nothing matches", () => {
    expect(negotiateLocale(undefined, null)).toBe("en");
    expect(negotiateLocale("fr", "fr-FR,fr;q=0.9")).toBe("en");
  });
});

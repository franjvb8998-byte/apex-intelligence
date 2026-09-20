import { describe, expect, it } from "vitest";
import { getAuthErrorKey, getAuthFailureKey } from "@/lib/supabase/auth-errors";

describe("getAuthFailureKey", () => {
  it("classifies invalid-credential API errors by code", () => {
    expect(
      getAuthFailureKey({
        name: "AuthApiError",
        message: "Invalid login credentials",
        code: "invalid_login_credentials",
        status: 400,
      }),
    ).toBe("invalidCredentials");
  });

  it("classifies browser fetch failures as network, not generic", () => {
    expect(getAuthFailureKey(new TypeError("Failed to fetch"))).toBe("network");
  });

  it("does not treat unrelated TypeErrors as network failures", () => {
    expect(getAuthFailureKey(new TypeError("Cannot read properties of undefined"))).toBe("generic");
  });

  it("classifies missing public Supabase env throws as configuration", () => {
    expect(
      getAuthFailureKey(new Error("Missing environment variable: NEXT_PUBLIC_SUPABASE_URL")),
    ).toBe("configuration");
  });

  it("keeps string message mapping for confirmed-email errors", () => {
    expect(getAuthErrorKey("Email not confirmed")).toBe("emailNotConfirmed");
    expect(getAuthFailureKey({ message: "Email not confirmed" })).toBe("emailNotConfirmed");
  });
});

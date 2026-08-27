import { describe, expect, it } from "vitest";
import {
  getNextPathForAuthCode,
  getPasswordRecoveryRedirectPath,
  getPasswordResetEmailRedirectTo,
  sanitizeNextPath,
} from "@/lib/auth/password-recovery";

describe("password recovery redirects", () => {
  it("points reset emails at the change-password page", () => {
    expect(getPasswordResetEmailRedirectTo("http://localhost:3000")).toBe(
      "http://localhost:3000/reset-password",
    );
  });

  it("sends implicit recovery tokens away from the landing hash", () => {
    expect(
      getPasswordRecoveryRedirectPath({
        pathname: "/",
        search: "",
        hash: "#access_token=abc&type=recovery&refresh_token=def",
      }),
    ).toBe("/reset-password#access_token=abc&type=recovery&refresh_token=def");
  });

  it("moves query-string recovery tokens into the hash", () => {
    expect(
      getPasswordRecoveryRedirectPath({
        pathname: "/",
        search: "?access_token=abc&type=recovery&refresh_token=def",
        hash: "",
      }),
    ).toBe("/reset-password#access_token=abc&type=recovery&refresh_token=def");
  });

  it("does not intercept the reset form once the hash is already there", () => {
    expect(
      getPasswordRecoveryRedirectPath({
        pathname: "/reset-password",
        search: "",
        hash: "#access_token=abc&type=recovery",
      }),
    ).toBeNull();
  });

  it("forwards PKCE codes on the landing to the auth callback", () => {
    expect(
      getPasswordRecoveryRedirectPath({
        pathname: "/",
        search: "?code=pkce-code",
        hash: "",
      }),
    ).toBe("/auth/callback?code=pkce-code&next=%2Freset-password");
  });

  it("forwards token_hash recovery links to the confirm route", () => {
    expect(
      getPasswordRecoveryRedirectPath({
        pathname: "/",
        search: "?token_hash=otp&type=recovery",
        hash: "",
      }),
    ).toBe("/auth/confirm?token_hash=otp&type=recovery&next=%2Freset-password");
  });

  it("sends expired recovery hashes away from the landing", () => {
    expect(
      getPasswordRecoveryRedirectPath({
        pathname: "/",
        search: "",
        hash: "#error=access_denied&error_code=otp_expired&type=recovery",
      }),
    ).toBe(
      "/reset-password#error=access_denied&error_code=otp_expired&type=recovery",
    );
  });

  it("ignores unrelated landing traffic", () => {
    expect(
      getPasswordRecoveryRedirectPath({
        pathname: "/",
        search: "",
        hash: "",
      }),
    ).toBeNull();
  });

  it("maps auth codes from / to reset-password and rejects open redirects", () => {
    expect(getNextPathForAuthCode("/")).toBe("/reset-password");
    expect(getNextPathForAuthCode("/reset-password")).toBe("/reset-password");
    expect(sanitizeNextPath("/reset-password")).toBe("/reset-password");
    expect(sanitizeNextPath("https://evil.example")).toBe("/dashboard");
    expect(sanitizeNextPath("//evil.example")).toBe("/dashboard");
  });
});

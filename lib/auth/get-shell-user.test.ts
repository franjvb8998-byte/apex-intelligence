import { describe, expect, it } from "vitest";
import { shellUserFromAuth } from "@/lib/auth/get-shell-user";

describe("shellUserFromAuth", () => {
  it("returns null when the auth user is missing", () => {
    expect(shellUserFromAuth(null)).toBeNull();
    expect(shellUserFromAuth(undefined)).toBeNull();
  });

  it("returns null when user.id is missing (no profile/user crash)", () => {
    expect(shellUserFromAuth({ email: "ada@example.com" })).toBeNull();
    expect(shellUserFromAuth({ id: "   ", email: "ada@example.com" })).toBeNull();
  });

  it("maps a complete auth user without requiring a profile row", () => {
    const user = shellUserFromAuth({
      id: "user-1",
      email: "ada@example.com",
      user_metadata: { full_name: "Ada Lovelace" },
    });
    expect(user).toEqual({
      id: "user-1",
      displayName: "Ada Lovelace",
      email: "ada@example.com",
    });
  });

  it("falls back to email when profile metadata is empty", () => {
    const user = shellUserFromAuth({
      id: "user-2",
      email: "ada@example.com",
      user_metadata: {},
    });
    expect(user?.displayName).toBe("ada");
    expect(user?.id).toBe("user-2");
  });
});

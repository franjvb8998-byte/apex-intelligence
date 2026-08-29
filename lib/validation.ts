export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export type PasswordValidationKey = "passwordRequired" | "passwordMinLength";

export function validatePassword(
  password: string,
): PasswordValidationKey | undefined {
  if (!password) return "passwordRequired";
  if (password.length < 6) return "passwordMinLength";
  return undefined;
}

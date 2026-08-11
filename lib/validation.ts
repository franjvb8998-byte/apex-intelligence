export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function validatePassword(password: string): string | undefined {
  if (!password) return "La contraseña es obligatoria.";
  if (password.length < 6) {
    return "La contraseña debe tener al menos 6 caracteres.";
  }
  return undefined;
}

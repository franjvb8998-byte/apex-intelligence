export function getAuthErrorMessage(error: string): string {
  const normalized = error.toLowerCase();

  if (normalized.includes("invalid login credentials")) {
    return "Email o contraseña incorrectos.";
  }

  if (normalized.includes("user already registered")) {
    return "Ya existe una cuenta con este email.";
  }

  if (normalized.includes("email not confirmed")) {
    return "Confirma tu email antes de iniciar sesión.";
  }

  if (normalized.includes("password")) {
    return "La contraseña no cumple los requisitos de seguridad.";
  }

  return "Ha ocurrido un error. Inténtalo de nuevo.";
}

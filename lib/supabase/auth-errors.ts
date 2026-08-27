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

  if (
    normalized.includes("different from the old password") ||
    normalized.includes("same password")
  ) {
    return "La nueva contraseña debe ser distinta a la anterior.";
  }

  if (
    normalized.includes("session missing") ||
    normalized.includes("invalid token") ||
    normalized.includes("token has expired") ||
    normalized.includes("otp_expired")
  ) {
    return "El enlace de recuperación no es válido o ha expirado. Solicita uno nuevo.";
  }

  if (
    normalized.includes("rate limit") ||
    normalized.includes("for security purposes") ||
    normalized.includes("over_email_send_rate_limit")
  ) {
    return "Espera un minuto antes de solicitar otro enlace.";
  }

  if (
    normalized.includes("redirect_to") ||
    normalized.includes("redirect uri mismatch")
  ) {
    return "La URL de recuperación no está permitida. Añade http://localhost:3000/reset-password en Redirect URLs de Supabase.";
  }

  if (normalized.includes("password")) {
    return "La contraseña no cumple los requisitos de seguridad.";
  }

  return "Ha ocurrido un error. Inténtalo de nuevo.";
}

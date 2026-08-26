/** Traduce los mensajes de error más comunes de Supabase Auth. */
export function authErrorMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : "";

  if (/invalid login credentials/i.test(raw)) {
    return "Correo o contraseña incorrectos.";
  }
  if (/email not confirmed/i.test(raw)) {
    return "Todavía no confirmas tu correo. Revisa tu bandeja de entrada.";
  }
  if (/user already registered/i.test(raw)) {
    return "Ya existe una cuenta con ese correo. Intenta iniciar sesión.";
  }
  if (/password should be at least/i.test(raw)) {
    return "La contraseña debe tener al menos 8 caracteres.";
  }
  if (/rate limit/i.test(raw)) {
    return "Demasiados intentos. Espera un momento e intenta de nuevo.";
  }
  if (/network/i.test(raw)) {
    return "No hay conexión. Verifica tu internet e intenta de nuevo.";
  }
  return raw || "Ocurrió un error inesperado. Intenta de nuevo.";
}

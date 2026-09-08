"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { issueVerificationCode } from "@/lib/auth/verification-codes";

/**
 * Nunca revela si el correo existe o no (evita enumeración de cuentas) — si
 * existe, se manda el código; si no, simplemente no pasa nada, pero la
 * respuesta es siempre "ok" para el frontend.
 */
export async function requestPasswordResetCodeAction(email: string): Promise<{ ok: true }> {
  const trimmedEmail = email.trim().toLowerCase();
  const admin = createAdminClient();
  if (!admin) return { ok: true };

  const { data: profile } = await admin.from("profiles").select("id").eq("email", trimmedEmail).maybeSingle();
  if (profile?.id) {
    await issueVerificationCode(profile.id as string, trimmedEmail, "recovery");
  }

  return { ok: true };
}

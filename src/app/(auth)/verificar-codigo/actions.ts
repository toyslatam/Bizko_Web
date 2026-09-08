"use server";

import { confirmVerificationCode, type VerificationPurpose } from "@/lib/auth/verification-codes";

export async function confirmCodeAction(
  email: string,
  code: string,
  password: string,
  purpose: VerificationPurpose,
): Promise<{ ok: true } | { error: string }> {
  if (!/^\d{6}$/.test(code.trim())) return { error: "El código debe tener 6 dígitos." };
  if (password.length < 8) return { error: "La contraseña debe tener al menos 8 caracteres." };

  return confirmVerificationCode(email, code, password, purpose);
}

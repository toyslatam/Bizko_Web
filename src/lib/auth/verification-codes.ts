import "server-only";
import { createHash, randomInt } from "crypto";
import { headers } from "next/headers";
import { Resend } from "resend";
import { createAdminClient } from "@/lib/supabase/admin";

export type VerificationPurpose = "invite" | "recovery";

const CODE_TTL_MINUTES = 15;

function hashCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

function generateCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

function getResend(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  return apiKey ? new Resend(apiKey) : null;
}

async function getVerifyUrl(email: string, purpose: VerificationPurpose): Promise<string> {
  const headerList = await headers();
  const host = headerList.get("host") ?? "bizko.online";
  const protocol = headerList.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${protocol}://${host}/verificar-codigo?email=${encodeURIComponent(email)}&type=${purpose}`;
}

function emailTemplate(title: string, intro: string, code: string, verifyUrl: string, ctaLabel: string): string {
  return `
<div style="margin:0;padding:0;background-color:#f4f3ff;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f3ff;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;background-color:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e5e1fb;">
        <tr><td style="background-color:#8b7cf6;padding:28px 32px;text-align:center;">
          <span style="font-size:20px;font-weight:700;color:#ffffff;">bizko</span>
        </td></tr>
        <tr><td style="padding:36px 32px 28px 32px;">
          <h1 style="margin:0 0 12px 0;font-size:20px;line-height:1.35;color:#1e1b4b;font-weight:700;">${title}</h1>
          <p style="margin:0 0 24px 0;font-size:14px;line-height:1.6;color:#4b5563;">${intro}</p>
          <div style="margin:0 auto 8px auto;text-align:center;">
            <span style="display:inline-block;padding:16px 28px;font-size:32px;font-weight:700;letter-spacing:6px;color:#1e1b4b;background-color:#f4f3ff;border-radius:12px;">${code}</span>
          </div>
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px auto 0 auto;">
            <tr><td style="border-radius:999px;background-color:#8b7cf6;">
              <a href="${verifyUrl}" style="display:inline-block;padding:12px 28px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:999px;">${ctaLabel}</a>
            </td></tr>
          </table>
          <p style="margin:24px 0 0 0;font-size:12px;line-height:1.6;color:#9ca3af;">
            Ese botón te lleva a la página donde escribes el código de arriba junto con tu contraseña.
            Si no funciona, entra directo a <a href="${verifyUrl}" style="color:#8b7cf6;">${verifyUrl}</a>.
          </p>
          <p style="margin:20px 0 0 0;font-size:12px;line-height:1.6;color:#9ca3af;">
            Este código expira en ${CODE_TTL_MINUTES} minutos. Si no esperabas este correo, puedes ignorarlo.
          </p>
        </td></tr>
        <tr><td style="padding:18px 32px;background-color:#faf9ff;text-align:center;border-top:1px solid #e5e1fb;">
          <span style="font-size:11px;color:#9ca3af;">bizko — Tu negocio, inteligente</span>
        </td></tr>
      </table>
    </td></tr>
  </table>
</div>`;
}

/**
 * Genera un código de 6 dígitos, lo guarda hasheado con expiración, y lo
 * envía por Resend directo — nunca pasa por el sistema de correo/OTP nativo
 * de Supabase Auth.
 */
export async function issueVerificationCode(
  userId: string,
  email: string,
  purpose: VerificationPurpose,
): Promise<{ ok: true } | { error: string }> {
  const admin = createAdminClient();
  if (!admin) return { error: "El envío de correos todavía no está disponible en este entorno." };

  const resend = getResend();
  if (!resend) return { error: "El envío de correos todavía no está disponible en este entorno." };

  const code = generateCode();
  const { error: insertError } = await admin.from("email_verification_codes").insert({
    user_id: userId,
    email,
    code_hash: hashCode(code),
    purpose,
    expires_at: new Date(Date.now() + CODE_TTL_MINUTES * 60_000).toISOString(),
  });
  if (insertError) return { error: "No pudimos generar el código. Intenta de nuevo." };

  const isInvite = purpose === "invite";
  const verifyUrl = await getVerifyUrl(email, purpose);
  const html = emailTemplate(
    isInvite ? "Te invitaron a un equipo en bizko" : "Restablece tu contraseña",
    isInvite
      ? "Alguien de tu negocio te dio acceso a bizko. Usa este código para crear tu contraseña."
      : "Pediste cambiar tu contraseña de bizko. Usa este código para elegir una nueva.",
    code,
    verifyUrl,
    isInvite ? "Ir a crear mi contraseña" : "Ir a elegir mi contraseña",
  );

  const { error: sendError } = await resend.emails.send({
    from: `bizko <no-reply@${process.env.RESEND_EMAIL_DOMAIN ?? "bizko.online"}>`,
    to: email,
    subject: isInvite ? "Tu código de invitación a bizko" : "Tu código para recuperar tu contraseña",
    html,
  });
  if (sendError) return { error: "No pudimos enviar el correo. Intenta de nuevo." };

  return { ok: true };
}

/**
 * Valida el código contra lo guardado y, si es correcto, pone la contraseña
 * directo con el service role (nunca se le pasa el código a Supabase Auth).
 */
export async function confirmVerificationCode(
  email: string,
  code: string,
  password: string,
  purpose: VerificationPurpose,
): Promise<{ ok: true } | { error: string }> {
  const admin = createAdminClient();
  if (!admin) return { error: "No disponible en este entorno." };

  const trimmedEmail = email.trim().toLowerCase();
  const { data: row } = await admin
    .from("email_verification_codes")
    .select("id, user_id, code_hash, expires_at, used_at")
    .eq("email", trimmedEmail)
    .eq("purpose", purpose)
    .is("used_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!row) return { error: "Código inválido. Pide uno nuevo." };
  if (new Date(row.expires_at as string) < new Date()) return { error: "Ese código ya expiró. Pide uno nuevo." };
  if (row.code_hash !== hashCode(code.trim())) return { error: "Código incorrecto." };

  const { error: updateError } = await admin.auth.admin.updateUserById(row.user_id as string, {
    password,
    email_confirm: true,
  });
  if (updateError) return { error: "No pudimos guardar la contraseña. Intenta de nuevo." };

  await admin.from("email_verification_codes").update({ used_at: new Date().toISOString() }).eq("id", row.id as string);

  return { ok: true };
}

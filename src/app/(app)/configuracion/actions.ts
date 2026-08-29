"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSessionContext } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { checkPlanLimit } from "@/lib/subscription";
import type { CompanyRole } from "@/types/database";

interface UpdateCompanyInput {
  companyId: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  description: string;
  businessHours: string;
  whatsappNumber: string;
}

export async function updateCompanyAction(
  input: UpdateCompanyInput,
): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("companies")
    .update({
      // business_type no se edita aquí: cambiar de vertical implica migrar
      // datos específicos (variantes, vehículos, citas, etc.), fuera de
      // alcance por ahora — ver Fase 9 §"Configuración".
      name: input.name,
      phone: input.phone || null,
      email: input.email || null,
      address: input.address || null,
      city: input.city || null,
      description: input.description || null,
      business_hours: input.businessHours || null,
      whatsapp_number: input.whatsappNumber || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.companyId);

  // RLS solo permite update al OWNER (o platform admin); un fallo aquí es
  // casi siempre por permisos, no por un error técnico.
  if (error) return { error: "No pudimos guardar los cambios. Solo el dueño puede editar el negocio." };

  revalidatePath("/configuracion");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function updateDeliverySettingsAction(input: {
  companyId: string;
  deliveryEnabled: boolean;
  pickupEnabled: boolean;
}): Promise<{ ok: true } | { error: string }> {
  if (!input.deliveryEnabled && !input.pickupEnabled) {
    return { error: "Activa al menos una forma de entrega." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("companies")
    .update({
      delivery_enabled: input.deliveryEnabled,
      pickup_enabled: input.pickupEnabled,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.companyId);

  if (error) return { error: "No pudimos guardar los cambios." };
  revalidatePath("/configuracion");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function updateCompanyLogoAction(
  companyId: string,
  logoUrl: string,
): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("companies")
    .update({ logo_url: logoUrl, updated_at: new Date().toISOString() })
    .eq("id", companyId);

  if (error) return { error: "No pudimos guardar el logo." };
  revalidatePath("/configuracion");
  return { ok: true };
}

export async function updateCompanyBannerAction(
  companyId: string,
  bannerUrl: string | null,
): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("companies")
    .update({ banner_url: bannerUrl, updated_at: new Date().toISOString() })
    .eq("id", companyId);

  if (error) return { error: "No pudimos guardar el banner." };
  revalidatePath("/configuracion");
  return { ok: true };
}

const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export async function updateCompanySlugAction(
  companyId: string,
  slug: string,
): Promise<{ ok: true } | { error: string }> {
  const trimmed = slug.trim().toLowerCase();
  if (trimmed.length < 3) return { error: "El URL debe tener al menos 3 caracteres." };
  if (!SLUG_RE.test(trimmed)) {
    return { error: "Solo minúsculas, números y guiones (sin espacios ni acentos)." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("companies")
    .update({ slug: trimmed, updated_at: new Date().toISOString() })
    .eq("id", companyId);

  if (error) {
    if (error.code === "23505") return { error: "Ese URL ya lo está usando otro negocio en bizko." };
    return { error: "No pudimos guardar el URL. Solo el dueño puede editarlo." };
  }

  revalidatePath("/configuracion");
  return { ok: true };
}

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

export async function updateCompanyAccentColorAction(
  companyId: string,
  accentColor: string | null,
): Promise<{ ok: true } | { error: string }> {
  if (accentColor !== null && !HEX_COLOR_RE.test(accentColor)) {
    return { error: "Color inválido." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("companies")
    .update({ accent_color: accentColor, updated_at: new Date().toISOString() })
    .eq("id", companyId);

  if (error) return { error: "No pudimos guardar el color." };
  revalidatePath("/configuracion");
  return { ok: true };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Invita a alguien a la empresa. Si el correo ya tiene cuenta en bizko
 * (de esta u otra empresa), se agrega directo como miembro activo — no hace
 * falta reenviar nada, ya tiene con qué iniciar sesión. Si es correo nuevo,
 * se crea el usuario de Auth y Supabase envía el correo de invitación (link
 * mágico); queda "invited" hasta que entre por primera vez — ver
 * getSessionContext(), que activa la membresía en cuanto detecta la sesión.
 */
export async function sendTeamInvitationAction(
  companyId: string,
  email: string,
  role: CompanyRole,
): Promise<{ ok: true; alreadyHadAccount: boolean } | { error: string }> {
  const trimmedEmail = email.trim().toLowerCase();
  if (!EMAIL_RE.test(trimmedEmail)) return { error: "Correo inválido." };
  if (role !== "manager" && role !== "employee") return { error: "Rol inválido." };

  const session = await getSessionContext();
  if (
    !session ||
    session.activeCompany?.id !== companyId ||
    !can(session.activeMembership?.role ?? "employee", "equipo.gestionar")
  ) {
    return { error: "No tienes permiso para invitar personas a este negocio." };
  }

  const supabase = await createClient();
  const limitCheck = await checkPlanLimit(supabase, companyId, "max_users");
  if (!limitCheck.ok) return { error: limitCheck.error };

  const admin = createAdminClient();
  if (!admin) {
    return { error: "El envío de invitaciones todavía no está disponible en este entorno." };
  }

  const { data: existingProfile } = await admin
    .from("profiles")
    .select("id")
    .eq("email", trimmedEmail)
    .maybeSingle();

  let userId = (existingProfile as { id: string } | null)?.id ?? null;
  const alreadyHadAccount = Boolean(userId);

  if (!userId) {
    const headerList = await headers();
    const host = headerList.get("host") ?? "";
    const protocol = headerList.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");

    const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(trimmedEmail, {
      redirectTo: `${protocol}://${host}/actualizar-password`,
    });
    if (inviteError || !invited?.user) {
      return { error: inviteError?.message || "No pudimos enviar la invitación. Intenta de nuevo." };
    }
    userId = invited.user.id;
  }

  const { error: memberError } = await supabase.from("company_members").insert({
    company_id: companyId,
    user_id: userId,
    role,
    status: alreadyHadAccount ? "active" : "invited",
  });

  if (memberError) {
    if (memberError.code === "23505") return { error: "Esa persona ya es parte de tu equipo." };
    return { error: "No pudimos agregar a la persona a tu equipo." };
  }

  revalidatePath("/configuracion");
  return { ok: true, alreadyHadAccount };
}

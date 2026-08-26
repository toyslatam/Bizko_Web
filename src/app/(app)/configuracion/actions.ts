"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

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

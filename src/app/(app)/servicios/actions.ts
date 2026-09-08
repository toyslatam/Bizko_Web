"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/lib/auth/session";
import type { EntityStatus, Service } from "@/types/database";

export interface ServiceInput {
  name: string;
  description: string;
  categoryId: string | null;
  price: string;
  durationMinutes: string;
  imageUrl: string | null;
}

type ActionResult =
  | { ok: true; id: string }
  | { error: string; fieldErrors?: Partial<Record<"name" | "price", string>> };

function parseMoneyToCents(value: string): number | null {
  const normalized = value.replace(/,/g, ".").trim();
  if (normalized === "") return 0;
  const n = Number(normalized);
  if (Number.isNaN(n) || n < 0) return null;
  return Math.round(n * 100);
}

function parseDuration(value: string): number | null {
  if (value.trim() === "") return null;
  const n = Number(value);
  if (Number.isNaN(n) || n < 0) return null;
  return Math.round(n);
}

function validate(input: ServiceInput) {
  const fieldErrors: Partial<Record<"name" | "price", string>> = {};
  if (!input.name.trim()) fieldErrors.name = "El nombre es obligatorio.";
  if (parseMoneyToCents(input.price) === null) {
    fieldErrors.price = "El precio debe ser mayor o igual a 0.";
  }
  return fieldErrors;
}

export async function createServiceAction(input: ServiceInput): Promise<ActionResult> {
  const fieldErrors = validate(input);
  if (Object.keys(fieldErrors).length > 0) return { error: "Revisa los campos.", fieldErrors };

  const session = await getSessionContext();
  if (!session?.activeCompany) return { error: "No encontramos tu negocio activo." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("services")
    .insert({
      company_id: session.activeCompany.id,
      name: input.name.trim(),
      description: input.description.trim() || null,
      category_id: input.categoryId,
      price_cents: parseMoneyToCents(input.price) ?? 0,
      duration_minutes: parseDuration(input.durationMinutes),
      image_url: input.imageUrl,
    })
    .select("id")
    .single();

  if (error || !data) return { error: "No pudimos crear el servicio." };

  revalidatePath("/servicios");
  revalidatePath("/dashboard");
  return { ok: true, id: data.id };
}

export async function updateServiceAction(
  id: string,
  input: ServiceInput,
): Promise<ActionResult> {
  const fieldErrors = validate(input);
  if (Object.keys(fieldErrors).length > 0) return { error: "Revisa los campos.", fieldErrors };

  const supabase = await createClient();
  const { error } = await supabase
    .from("services")
    .update({
      name: input.name.trim(),
      description: input.description.trim() || null,
      category_id: input.categoryId,
      price_cents: parseMoneyToCents(input.price) ?? 0,
      duration_minutes: parseDuration(input.durationMinutes),
      image_url: input.imageUrl,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) return { error: "No pudimos guardar los cambios." };

  revalidatePath("/servicios");
  revalidatePath(`/servicios/${id}`);
  return { ok: true, id };
}

export async function updateServicePackageAction(
  serviceId: string,
  isPackage: boolean,
  componentServiceIds: string[],
): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();

  const uniqueIds = Array.from(new Set(componentServiceIds)).filter((id) => id !== serviceId);

  if (uniqueIds.length > 0) {
    const { data: componentsData } = await supabase
      .from("services")
      .select("id, is_package")
      .in("id", uniqueIds);
    const validIds = new Set(
      ((componentsData ?? []) as Pick<Service, "id" | "is_package">[])
        .filter((s) => !s.is_package)
        .map((s) => s.id),
    );
    componentServiceIds = uniqueIds.filter((id) => validIds.has(id));
  } else {
    componentServiceIds = [];
  }

  const { error: updateError } = await supabase
    .from("services")
    .update({ is_package: isPackage, updated_at: new Date().toISOString() })
    .eq("id", serviceId);

  if (updateError) return { error: "No pudimos guardar el paquete." };

  const { error: deleteError } = await supabase
    .from("service_package_items")
    .delete()
    .eq("package_service_id", serviceId);

  if (deleteError) return { error: "No pudimos guardar el paquete." };

  if (isPackage && componentServiceIds.length > 0) {
    const { error: insertError } = await supabase.from("service_package_items").insert(
      componentServiceIds.map((componentServiceId, index) => ({
        package_service_id: serviceId,
        component_service_id: componentServiceId,
        sort_order: index,
      })),
    );
    if (insertError) return { error: "No pudimos guardar el paquete." };
  }

  revalidatePath("/servicios");
  revalidatePath(`/servicios/${serviceId}`);
  return { ok: true };
}

export async function setServiceStatusAction(
  id: string,
  status: EntityStatus,
): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("services")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return { error: "No pudimos actualizar el estado." };

  revalidatePath("/servicios");
  revalidatePath(`/servicios/${id}`);
  return { ok: true };
}

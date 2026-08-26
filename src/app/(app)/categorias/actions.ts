"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/lib/auth/session";
import type { EntityStatus } from "@/types/database";

export type CategoryKind = "product" | "service" | "expense";

const TABLE: Record<CategoryKind, "product_categories" | "service_categories" | "expense_categories"> = {
  product: "product_categories",
  service: "service_categories",
  expense: "expense_categories",
};

function revalidateForKind(kind: CategoryKind) {
  revalidatePath("/categorias");
  if (kind === "expense") revalidatePath("/gastos");
}

export interface CategoryInput {
  name: string;
  description: string;
}

type ActionResult =
  | { ok: true; id: string }
  | { error: string; fieldErrors?: Partial<Record<keyof CategoryInput, string>> };

export async function createCategoryAction(
  kind: CategoryKind,
  input: CategoryInput,
): Promise<ActionResult> {
  if (!input.name.trim()) {
    return { error: "Revisa los campos.", fieldErrors: { name: "El nombre es obligatorio." } };
  }

  const session = await getSessionContext();
  if (!session?.activeCompany) return { error: "No encontramos tu negocio activo." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from(TABLE[kind])
    .insert({
      company_id: session.activeCompany.id,
      name: input.name.trim(),
      description: input.description.trim() || null,
    })
    .select("id")
    .single();

  if (error || !data) return { error: "No pudimos crear la categoría." };

  revalidateForKind(kind);
  return { ok: true, id: data.id };
}

export async function updateCategoryAction(
  kind: CategoryKind,
  id: string,
  input: CategoryInput,
): Promise<ActionResult> {
  if (!input.name.trim()) {
    return { error: "Revisa los campos.", fieldErrors: { name: "El nombre es obligatorio." } };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from(TABLE[kind])
    .update({
      name: input.name.trim(),
      description: input.description.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) return { error: "No pudimos guardar los cambios." };

  revalidateForKind(kind);
  return { ok: true, id };
}

export async function setCategoryStatusAction(
  kind: CategoryKind,
  id: string,
  status: EntityStatus,
): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from(TABLE[kind])
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return { error: "No pudimos actualizar el estado." };

  revalidateForKind(kind);
  return { ok: true };
}

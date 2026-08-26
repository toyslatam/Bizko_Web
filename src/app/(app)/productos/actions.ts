"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/lib/auth/session";
import { checkPlanLimit } from "@/lib/subscription";
import type { EntityStatus, ProductUnit } from "@/types/database";

export interface ProductInput {
  name: string;
  description: string;
  sku: string;
  categoryId: string | null;
  price: string;
  cost: string;
  unit: ProductUnit;
  imageUrl: string | null;
  trackInventory: boolean;
  minimumStock: string;
  /** Solo se usa al crear: se convierte en un movimiento de entrada, nunca en un UPDATE directo. */
  initialStock?: string;
  isPublished: boolean;
  hasVariants: boolean;
  isFeatured: boolean;
  isIngredient: boolean;
  isCombo: boolean;
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

function parseQuantity(value: string): number | null {
  const normalized = value.replace(/,/g, ".").trim();
  if (normalized === "") return 0;
  const n = Number(normalized);
  if (Number.isNaN(n) || n < 0) return null;
  return n;
}

function validate(input: ProductInput) {
  const fieldErrors: Partial<Record<"name" | "price", string>> = {};
  if (!input.name.trim()) fieldErrors.name = "El nombre es obligatorio.";
  if (parseMoneyToCents(input.price) === null) {
    fieldErrors.price = "El precio debe ser mayor o igual a 0.";
  }
  return fieldErrors;
}

export async function createProductAction(input: ProductInput): Promise<ActionResult> {
  const fieldErrors = validate(input);
  if (Object.keys(fieldErrors).length > 0) return { error: "Revisa los campos.", fieldErrors };

  const session = await getSessionContext();
  if (!session?.activeCompany) return { error: "No encontramos tu negocio activo." };

  const supabase = await createClient();
  const limitCheck = await checkPlanLimit(supabase, session.activeCompany.id, "max_products");
  if (!limitCheck.ok) return { error: limitCheck.error };

  const { data, error } = await supabase
    .from("products")
    .insert({
      company_id: session.activeCompany.id,
      name: input.name.trim(),
      description: input.description.trim() || null,
      sku: input.sku.trim() || null,
      category_id: input.categoryId,
      price_cents: parseMoneyToCents(input.price) ?? 0,
      cost_cents: parseMoneyToCents(input.cost) ?? 0,
      unit: input.unit,
      image_url: input.imageUrl,
      track_inventory: input.hasVariants ? false : input.trackInventory,
      minimum_stock: parseQuantity(input.minimumStock) ?? 0,
      is_published: input.isPublished,
      has_variants: input.hasVariants,
      is_featured: input.isFeatured,
      is_ingredient: input.isIngredient,
      is_combo: input.isCombo,
    })
    .select("id")
    .single();

  if (error || !data) return { error: "No pudimos crear el producto." };

  // El stock nunca se escribe directo: el inicial se registra como un
  // movimiento de entrada para mantener la trazabilidad desde el día uno.
  const initialStock = parseQuantity(input.initialStock ?? "0") ?? 0;
  if (input.trackInventory && initialStock > 0) {
    await supabase.rpc("apply_inventory_movement", {
      p_company_id: session.activeCompany.id,
      p_product_id: data.id,
      p_movement_type: "in",
      p_quantity: initialStock,
      p_reason: "Stock inicial",
      p_reference_type: null,
      p_reference_id: null,
    });
  }

  revalidatePath("/productos");
  revalidatePath("/inventario");
  revalidatePath("/dashboard");
  return { ok: true, id: data.id };
}

export async function updateProductAction(
  id: string,
  input: ProductInput,
): Promise<ActionResult> {
  const fieldErrors = validate(input);
  if (Object.keys(fieldErrors).length > 0) return { error: "Revisa los campos.", fieldErrors };

  const supabase = await createClient();
  const newPriceCents = parseMoneyToCents(input.price) ?? 0;

  const { data: existing } = await supabase
    .from("products")
    .select("company_id, price_cents")
    .eq("id", id)
    .maybeSingle();

  const { error } = await supabase
    .from("products")
    .update({
      name: input.name.trim(),
      description: input.description.trim() || null,
      sku: input.sku.trim() || null,
      category_id: input.categoryId,
      price_cents: newPriceCents,
      cost_cents: parseMoneyToCents(input.cost) ?? 0,
      unit: input.unit,
      image_url: input.imageUrl,
      track_inventory: input.hasVariants ? false : input.trackInventory,
      minimum_stock: parseQuantity(input.minimumStock) ?? 0,
      is_published: input.isPublished,
      has_variants: input.hasVariants,
      is_featured: input.isFeatured,
      is_ingredient: input.isIngredient,
      is_combo: input.isCombo,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) return { error: "No pudimos guardar los cambios." };

  // Auditoría de precio (Fase 14 §39) — solo si realmente cambió, para no
  // llenar el historial con guardados que no tocaron el precio.
  if (existing && existing.price_cents !== newPriceCents) {
    const session = await getSessionContext();
    await supabase.from("business_audit_logs").insert({
      company_id: existing.company_id,
      user_id: session?.userId ?? null,
      action: "PRICE_CHANGED",
      target_type: "product",
      target_id: id,
      metadata: { old_price_cents: existing.price_cents, new_price_cents: newPriceCents },
    });
  }

  revalidatePath("/productos");
  revalidatePath(`/productos/${id}`);
  revalidatePath("/inventario");
  return { ok: true, id };
}

export async function setProductStatusAction(
  id: string,
  status: EntityStatus,
): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("products")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return { error: "No pudimos actualizar el estado." };

  revalidatePath("/productos");
  revalidatePath(`/productos/${id}`);
  return { ok: true };
}

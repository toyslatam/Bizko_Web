"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/lib/auth/session";
import type { EntityStatus } from "@/types/database";

export interface VariantAttributeInput {
  name: string;
  value: string;
}

export interface VariantInput {
  sku: string;
  price: string;
  cost: string;
  stock: string;
  attributes: VariantAttributeInput[];
}

type ActionResult<T extends object = object> = ({ ok: true } & T) | { error: string };

function parseMoneyToCents(value: string): number {
  const n = Number(value.replace(/,/g, ".").trim() || "0");
  return Number.isNaN(n) || n < 0 ? 0 : Math.round(n * 100);
}

function parseQuantity(value: string): number {
  const n = Number(value.replace(/,/g, ".").trim() || "0");
  return Number.isNaN(n) || n < 0 ? 0 : n;
}

export async function createVariantAction(
  productId: string,
  input: VariantInput,
): Promise<ActionResult<{ id: string }>> {
  const attrs = input.attributes.filter((a) => a.name.trim() && a.value.trim());
  if (attrs.length === 0) return { error: "Agrega al menos un atributo (ej. Talla, Color)." };

  const session = await getSessionContext();
  if (!session?.activeCompany) return { error: "No encontramos tu negocio activo." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("product_variants")
    .insert({
      company_id: session.activeCompany.id,
      product_id: productId,
      sku: input.sku.trim() || null,
      price_cents: parseMoneyToCents(input.price),
      cost_cents: parseMoneyToCents(input.cost),
      stock: parseQuantity(input.stock),
    })
    .select("id")
    .single();

  if (error || !data) return { error: "No pudimos crear la variante." };

  const { error: attrError } = await supabase.from("variant_attributes").insert(
    attrs.map((a) => ({ variant_id: data.id, attribute_name: a.name.trim(), attribute_value: a.value.trim() })),
  );
  if (attrError) return { error: "No pudimos guardar los atributos de la variante." };

  await supabase.from("products").update({ has_variants: true }).eq("id", productId);

  revalidatePath(`/productos/${productId}`);
  revalidatePath("/productos");
  return { ok: true, id: data.id };
}

export async function updateVariantAction(id: string, productId: string, input: VariantInput): Promise<ActionResult> {
  const attrs = input.attributes.filter((a) => a.name.trim() && a.value.trim());
  if (attrs.length === 0) return { error: "Agrega al menos un atributo (ej. Talla, Color)." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("product_variants")
    .update({
      sku: input.sku.trim() || null,
      price_cents: parseMoneyToCents(input.price),
      cost_cents: parseMoneyToCents(input.cost),
      stock: parseQuantity(input.stock),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) return { error: "No pudimos guardar los cambios." };

  await supabase.from("variant_attributes").delete().eq("variant_id", id);
  const { error: attrError } = await supabase
    .from("variant_attributes")
    .insert(attrs.map((a) => ({ variant_id: id, attribute_name: a.name.trim(), attribute_value: a.value.trim() })));
  if (attrError) return { error: "No pudimos guardar los atributos de la variante." };

  revalidatePath(`/productos/${productId}`);
  revalidatePath("/productos");
  return { ok: true };
}

export async function setVariantStatusAction(
  id: string,
  productId: string,
  status: EntityStatus,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("product_variants")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return { error: "No pudimos actualizar la variante." };
  revalidatePath(`/productos/${productId}`);
  return { ok: true };
}

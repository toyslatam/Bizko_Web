"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/lib/auth/session";
import type { ModifierSelectionType } from "@/types/database";

export interface ModifierOptionInput {
  name: string;
  price: string;
}

export interface ModifierGroupInput {
  name: string;
  selectionType: ModifierSelectionType;
  isRequired: boolean;
  maxSelections: string;
  options: ModifierOptionInput[];
}

type ActionResult<T extends object = object> = ({ ok: true } & T) | { error: string };

function parseMoneyToCents(value: string): number {
  const n = Number(value.replace(/,/g, ".").trim() || "0");
  return Number.isNaN(n) || n < 0 ? 0 : Math.round(n * 100);
}

function parseMaxSelections(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  const n = Number(trimmed);
  if (Number.isNaN(n) || n <= 0) return null;
  return Math.round(n);
}

function validateGroup(input: ModifierGroupInput) {
  if (!input.name.trim()) return "El nombre del grupo es obligatorio.";
  const options = input.options.filter((o) => o.name.trim());
  if (options.length === 0) return "Agrega al menos una opción.";
  return null;
}

export async function createModifierGroupAction(
  productId: string,
  input: ModifierGroupInput,
): Promise<ActionResult<{ id: string }>> {
  const validationError = validateGroup(input);
  if (validationError) return { error: validationError };

  const session = await getSessionContext();
  if (!session?.activeCompany) return { error: "No encontramos tu negocio activo." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("modifier_groups")
    .insert({
      company_id: session.activeCompany.id,
      product_id: productId,
      name: input.name.trim(),
      selection_type: input.selectionType,
      is_required: input.isRequired,
      max_selections: input.selectionType === "multiple" ? parseMaxSelections(input.maxSelections) : null,
    })
    .select("id")
    .single();

  if (error || !data) return { error: "No pudimos crear el grupo de modificadores." };

  const options = input.options.filter((o) => o.name.trim());
  const { error: optionsError } = await supabase.from("modifier_options").insert(
    options.map((o, i) => ({
      modifier_group_id: data.id,
      name: o.name.trim(),
      price_cents: parseMoneyToCents(o.price),
      sort_order: i,
    })),
  );
  if (optionsError) return { error: "No pudimos guardar las opciones del grupo." };

  revalidatePath(`/productos/${productId}`);
  return { ok: true, id: data.id };
}

export async function updateModifierGroupAction(
  groupId: string,
  productId: string,
  input: ModifierGroupInput,
): Promise<ActionResult> {
  const validationError = validateGroup(input);
  if (validationError) return { error: validationError };

  const supabase = await createClient();
  const { error } = await supabase
    .from("modifier_groups")
    .update({
      name: input.name.trim(),
      selection_type: input.selectionType,
      is_required: input.isRequired,
      max_selections: input.selectionType === "multiple" ? parseMaxSelections(input.maxSelections) : null,
    })
    .eq("id", groupId);

  if (error) return { error: "No pudimos guardar los cambios del grupo." };

  const { error: deleteError } = await supabase.from("modifier_options").delete().eq("modifier_group_id", groupId);
  if (deleteError) return { error: "No pudimos actualizar las opciones del grupo." };

  const options = input.options.filter((o) => o.name.trim());
  const { error: optionsError } = await supabase.from("modifier_options").insert(
    options.map((o, i) => ({
      modifier_group_id: groupId,
      name: o.name.trim(),
      price_cents: parseMoneyToCents(o.price),
      sort_order: i,
    })),
  );
  if (optionsError) return { error: "No pudimos guardar las opciones del grupo." };

  revalidatePath(`/productos/${productId}`);
  return { ok: true };
}

export async function deleteModifierGroupAction(groupId: string, productId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("modifier_groups").delete().eq("id", groupId);
  if (error) return { error: "No pudimos eliminar el grupo de modificadores." };

  revalidatePath(`/productos/${productId}`);
  return { ok: true };
}

export async function addComboItemAction(
  comboProductId: string,
  componentProductId: string,
  quantity: string,
): Promise<ActionResult<{ id: string }>> {
  if (!componentProductId) return { error: "Selecciona un producto." };
  const parsedQuantity = Number(quantity.replace(/,/g, ".").trim() || "0");
  if (Number.isNaN(parsedQuantity) || parsedQuantity <= 0) {
    return { error: "La cantidad debe ser mayor a 0." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("combo_items")
    .insert({
      combo_product_id: comboProductId,
      component_product_id: componentProductId,
      quantity: parsedQuantity,
    })
    .select("id")
    .single();

  if (error || !data) return { error: "No pudimos agregar el producto al combo." };

  revalidatePath(`/productos/${comboProductId}`);
  return { ok: true, id: data.id };
}

export async function removeComboItemAction(comboItemId: string, comboProductId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("combo_items").delete().eq("id", comboItemId);
  if (error) return { error: "No pudimos quitar el producto del combo." };

  revalidatePath(`/productos/${comboProductId}`);
  return { ok: true };
}

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import type { InventoryMovementType } from "@/types/database";

export interface CreateMovementInput {
  productId: string;
  /** Solo para productos con variantes: el stock vive en la variante. */
  variantId?: string | null;
  movementType: InventoryMovementType;
  quantity: number;
  reason: string;
}

type ActionResult = { ok: true } | { error: string };

export async function createMovementAction(input: CreateMovementInput): Promise<ActionResult> {
  const session = await getSessionContext();
  if (!session?.activeCompany || !session.activeMembership) {
    return { error: "No encontramos tu negocio activo." };
  }
  if (!can(session.activeMembership.role, "inventario.editar")) {
    return { error: "No tienes permiso para registrar movimientos de inventario." };
  }
  if (!input.reason.trim()) {
    return { error: "El motivo es obligatorio." };
  }
  if (!input.quantity || (input.movementType !== "adjustment" && input.quantity <= 0)) {
    return { error: "La cantidad debe ser mayor a 0." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("apply_inventory_movement", {
    p_company_id: session.activeCompany.id,
    p_product_id: input.productId,
    p_movement_type: input.movementType,
    p_quantity: input.quantity,
    p_reason: input.reason.trim(),
    p_reference_type: "manual",
    p_reference_id: null,
    p_variant_id: input.variantId ?? null,
  });

  if (error) return { error: error.message || "No pudimos registrar el movimiento." };

  revalidatePath("/inventario");
  revalidatePath("/inventario/movimientos");
  revalidatePath(`/productos/${input.productId}`);
  revalidatePath("/dashboard");
  return { ok: true };
}

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/lib/auth/session";
import { can } from "@/lib/permissions";

type ActionResult<T extends object = object> = ({ ok: true } & T) | { error: string };

// Los mensajes de las funciones SQL (raise exception) ya están en español y
// pensados para mostrarse tal cual al usuario.
function rpcErrorMessage(error: { message: string } | null, fallback: string): string {
  return error?.message || fallback;
}

export interface CreateTableInput {
  name: string;
  capacity: number | null;
}

export async function createTableAction(input: CreateTableInput): Promise<ActionResult<{ id: string }>> {
  if (!input.name.trim()) return { error: "El nombre de la mesa es obligatorio." };

  const session = await getSessionContext();
  if (!session?.activeCompany) return { error: "No encontramos tu negocio activo." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("restaurant_tables")
    .insert({
      company_id: session.activeCompany.id,
      name: input.name.trim(),
      capacity: input.capacity,
    })
    .select("id")
    .single();

  if (error || !data) return { error: "No pudimos crear la mesa." };
  revalidatePath("/mesas");
  return { ok: true, id: data.id };
}

export interface SubmitTableOrderItem {
  productId: string;
  quantity: number;
  notes?: string;
  modifierOptionIds?: string[];
}

type SubmitTableOrderResult = { ok: true; orderId: string } | { error: string };

export async function submitTableOrderAction(
  tableId: string,
  items: SubmitTableOrderItem[],
  notes?: string,
): Promise<SubmitTableOrderResult> {
  if (items.length === 0) return { error: "Agrega al menos un producto al pedido." };

  const session = await getSessionContext();
  if (!session?.activeCompany || !session.activeMembership) return { error: "No encontramos tu sesión." };
  if (!can(session.activeMembership.role, "pedidos.gestionar")) {
    return { error: "No tienes permiso para tomar pedidos." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("create_dine_in_order", {
      p_company_id: session.activeCompany.id,
      p_table_id: tableId,
      p_items: items.map((item) => ({
        product_id: item.productId,
        quantity: item.quantity,
        notes: item.notes ?? null,
        modifiers: (item.modifierOptionIds ?? []).map((id) => ({ option_id: id })),
      })),
      p_notes: notes ?? null,
    })
    .single();

  if (error || !data) {
    return { error: rpcErrorMessage(error, "No pudimos enviar el pedido. Intenta de nuevo.") };
  }

  const order = data as { id: string };
  revalidatePath("/mesas");
  revalidatePath(`/mesas/${tableId}`);
  revalidatePath("/pedidos");
  revalidatePath("/cocina");
  return { ok: true, orderId: order.id };
}

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/lib/auth/session";
import type { LaundryOrderStatus } from "@/types/database";

export interface LaundryOrderItemInput {
  serviceId: string | null;
  description: string;
  quantity: number;
}

export interface LaundryOrderInput {
  customerId: string | null;
  estimatedReadyAt: string | null;
  notes: string;
  items: LaundryOrderItemInput[];
}

type ActionResult = { ok: true; id: string } | { error: string };

// Los mensajes de las funciones SQL (raise exception) ya están en español y
// pensados para mostrarse tal cual al usuario.
function rpcErrorMessage(error: { message: string } | null, fallback: string): string {
  return error?.message || fallback;
}

export async function createLaundryOrderAction(
  input: LaundryOrderInput,
): Promise<ActionResult> {
  if (input.items.length === 0) {
    return { error: "Agrega al menos una prenda." };
  }

  const session = await getSessionContext();
  if (!session?.activeCompany) return { error: "No encontramos tu negocio activo." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("create_laundry_order", {
      p_company_id: session.activeCompany.id,
      p_customer_id: input.customerId,
      p_estimated_ready_at: input.estimatedReadyAt,
      p_notes: input.notes.trim() || null,
      p_items: input.items.map((item) => ({
        service_id: item.serviceId,
        description: item.description,
        quantity: item.quantity,
      })),
    })
    .single();

  if (error || !data) {
    return { error: rpcErrorMessage(error, "No pudimos crear la orden. Intenta de nuevo.") };
  }

  const order = data as { id: string };
  revalidatePath("/lavanderia");
  revalidatePath("/dashboard");
  return { ok: true, id: order.id };
}

export async function setLaundryOrderStatusAction(
  id: string,
  status: LaundryOrderStatus,
): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("laundry_orders")
    .update({
      status,
      delivered_at: status === "delivered" ? new Date().toISOString() : undefined,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) return { error: "No pudimos actualizar el estado." };

  revalidatePath("/lavanderia");
  revalidatePath(`/lavanderia/${id}`);
  return { ok: true };
}

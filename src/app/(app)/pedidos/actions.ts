"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import type { OrderStatus } from "@/types/database";

export async function setOrderStatusAction(
  orderId: string,
  status: OrderStatus,
  paymentReceived = false,
): Promise<{ ok: true } | { error: string }> {
  const session = await getSessionContext();
  if (!session?.activeMembership) return { error: "No encontramos tu sesión." };
  if (!can(session.activeMembership.role, "pedidos.gestionar")) {
    return { error: "No tienes permiso para gestionar pedidos." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .rpc("set_order_status", {
      p_order_id: orderId,
      p_status: status,
      p_payment_received: paymentReceived,
    })
    .single();

  if (error) return { error: error.message || "No pudimos actualizar el pedido." };

  revalidatePath("/pedidos");
  revalidatePath(`/pedidos/${orderId}`);
  revalidatePath("/dashboard");
  revalidatePath("/caja");
  return { ok: true };
}

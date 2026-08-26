"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/lib/auth/session";
import type { WorkOrderStatus } from "@/types/database";

export interface CreateWorkOrderInput {
  customerId: string | null;
  vehicleId: string | null;
  description: string;
  estimatedTotalCents: number | null;
}

export interface UpdateWorkOrderDetailsInput {
  diagnosis: string;
  finalTotalCents: number | null;
}

type ActionResult = { ok: true; id: string } | { error: string };

// Los mensajes de las funciones SQL (raise exception) ya están en español y
// pensados para mostrarse tal cual al usuario.
function rpcErrorMessage(error: { message: string } | null, fallback: string): string {
  return error?.message || fallback;
}

export async function createWorkOrderAction(input: CreateWorkOrderInput): Promise<ActionResult> {
  const session = await getSessionContext();
  if (!session?.activeCompany) return { error: "No encontramos tu negocio activo." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("create_work_order", {
      p_company_id: session.activeCompany.id,
      p_customer_id: input.customerId,
      p_vehicle_id: input.vehicleId,
      p_description: input.description.trim() || null,
      p_estimated_total_cents: input.estimatedTotalCents,
    })
    .single();

  if (error || !data) {
    return { error: rpcErrorMessage(error, "No pudimos crear la orden de trabajo.") };
  }

  const order = data as { id: string };
  revalidatePath("/ordenes-trabajo");
  revalidatePath("/dashboard");
  return { ok: true, id: order.id };
}

export async function setWorkOrderStatusAction(
  id: string,
  status: WorkOrderStatus,
): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("work_orders")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return { error: "No pudimos actualizar el estado." };

  revalidatePath("/ordenes-trabajo");
  revalidatePath(`/ordenes-trabajo/${id}`);
  return { ok: true };
}

export async function updateWorkOrderDetailsAction(
  id: string,
  input: UpdateWorkOrderDetailsInput,
): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("work_orders")
    .update({
      diagnosis: input.diagnosis.trim() || null,
      final_total_cents: input.finalTotalCents,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) return { error: "No pudimos guardar los cambios." };

  revalidatePath("/ordenes-trabajo");
  revalidatePath(`/ordenes-trabajo/${id}`);
  return { ok: true };
}

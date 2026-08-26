"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import type { CashMovementType, PaymentMethod } from "@/types/database";

type ActionResult<T extends object = object> = ({ ok: true } & T) | { error: string };

function rpcErrorMessage(error: { message: string } | null, fallback: string): string {
  return error?.message || fallback;
}

export async function openCashRegisterAction(input: {
  openingAmountCents: number;
  notes: string;
}): Promise<ActionResult<{ id: string }>> {
  const session = await getSessionContext();
  if (!session?.activeCompany || !session.activeMembership) {
    return { error: "No encontramos tu negocio activo." };
  }
  if (!can(session.activeMembership.role, "caja.administrar")) {
    return { error: "No tienes permiso para abrir la caja." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("open_cash_register", {
      p_company_id: session.activeCompany.id,
      p_opening_amount_cents: input.openingAmountCents,
      p_notes: input.notes,
    })
    .single();

  if (error || !data) return { error: rpcErrorMessage(error, "No pudimos abrir la caja.") };

  revalidatePath("/caja");
  revalidatePath("/dashboard");
  return { ok: true, id: (data as { id: string }).id };
}

export async function closeCashRegisterAction(input: {
  cashRegisterId: string;
  countedAmountCents: number;
  notes: string;
}): Promise<ActionResult> {
  const session = await getSessionContext();
  if (!session?.activeMembership) return { error: "No encontramos tu sesión." };
  if (!can(session.activeMembership.role, "caja.administrar")) {
    return { error: "No tienes permiso para cerrar la caja." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .rpc("close_cash_register", {
      p_cash_register_id: input.cashRegisterId,
      p_counted_amount_cents: input.countedAmountCents,
      p_notes: input.notes,
    })
    .single();

  if (error) return { error: rpcErrorMessage(error, "No pudimos cerrar la caja.") };

  revalidatePath("/caja");
  revalidatePath("/caja/historial");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function createManualMovementAction(input: {
  cashRegisterId: string;
  movementType: Extract<CashMovementType, "income" | "expense">;
  amountCents: number;
  paymentMethod: PaymentMethod;
  description: string;
}): Promise<ActionResult> {
  const session = await getSessionContext();
  if (!session?.activeCompany || !session.activeMembership) {
    return { error: "No encontramos tu negocio activo." };
  }
  if (!can(session.activeMembership.role, "caja.registrar")) {
    return { error: "No tienes permiso para registrar movimientos." };
  }
  if (!input.description.trim()) return { error: "La descripción es obligatoria." };
  if (!input.amountCents || input.amountCents <= 0) {
    return { error: "El monto debe ser mayor a 0." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_cash_movement", {
    p_company_id: session.activeCompany.id,
    p_cash_register_id: input.cashRegisterId,
    p_movement_type: input.movementType,
    p_amount_cents: input.amountCents,
    p_payment_method: input.paymentMethod,
    p_reference_type: "manual",
    p_reference_id: null,
    p_description: input.description,
  });

  if (error) return { error: rpcErrorMessage(error, "No pudimos registrar el movimiento.") };

  revalidatePath("/caja");
  revalidatePath("/dashboard");
  return { ok: true };
}

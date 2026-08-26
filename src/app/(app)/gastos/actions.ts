"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import type { PaymentMethod } from "@/types/database";

export interface ExpenseInput {
  categoryId: string | null;
  description: string;
  amount: string;
  paymentMethod: PaymentMethod;
  date: string;
  notes: string;
}

type ActionResult =
  | { ok: true; id: string }
  | { error: string; fieldErrors?: Partial<Record<"description" | "amount", string>> };

function parseMoneyToCents(value: string): number | null {
  const normalized = value.replace(/,/g, ".").trim();
  if (normalized === "") return null;
  const n = Number(normalized);
  if (Number.isNaN(n) || n <= 0) return null;
  return Math.round(n * 100);
}

function rpcErrorMessage(error: { message: string } | null, fallback: string): string {
  return error?.message || fallback;
}

export async function createExpenseAction(input: ExpenseInput): Promise<ActionResult> {
  const fieldErrors: Partial<Record<"description" | "amount", string>> = {};
  if (!input.description.trim()) fieldErrors.description = "La descripción es obligatoria.";
  const amountCents = parseMoneyToCents(input.amount);
  if (amountCents === null) fieldErrors.amount = "El monto debe ser mayor a 0.";
  if (Object.keys(fieldErrors).length > 0) return { error: "Revisa los campos.", fieldErrors };

  const session = await getSessionContext();
  if (!session?.activeCompany) return { error: "No encontramos tu negocio activo." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("create_expense", {
      p_company_id: session.activeCompany.id,
      p_category_id: input.categoryId,
      p_description: input.description,
      p_amount_cents: amountCents,
      p_payment_method: input.paymentMethod,
      p_date: input.date || new Date().toISOString().slice(0, 10),
      p_notes: input.notes,
    })
    .single();

  if (error || !data) return { error: rpcErrorMessage(error, "No pudimos registrar el gasto.") };

  revalidatePath("/gastos");
  revalidatePath("/caja");
  revalidatePath("/dashboard");
  return { ok: true, id: (data as { id: string }).id };
}

export async function voidExpenseAction(id: string): Promise<{ ok: true } | { error: string }> {
  const session = await getSessionContext();
  if (!session?.activeMembership) return { error: "No encontramos tu sesión." };
  if (!can(session.activeMembership.role, "gastos.anular")) {
    return { error: "No tienes permiso para anular gastos." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("void_expense", { p_expense_id: id }).single();

  if (error) return { error: rpcErrorMessage(error, "No pudimos anular el gasto.") };

  revalidatePath("/gastos");
  revalidatePath("/caja");
  revalidatePath("/dashboard");
  return { ok: true };
}

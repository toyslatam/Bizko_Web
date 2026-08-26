"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/lib/auth/session";
import { checkPlanLimit } from "@/lib/subscription";
import type { EntityStatus } from "@/types/database";

export interface CustomerInput {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  notes: string;
}

type ActionResult =
  | { ok: true; id: string }
  | { error: string; fieldErrors?: Partial<Record<keyof CustomerInput, string>> };

function validate(input: CustomerInput): Partial<Record<keyof CustomerInput, string>> {
  const errors: Partial<Record<keyof CustomerInput, string>> = {};
  if (!input.firstName.trim()) errors.firstName = "El nombre es obligatorio.";
  if (input.email && !/^\S+@\S+\.\S+$/.test(input.email)) {
    errors.email = "Ingresa un correo válido.";
  }
  return errors;
}

export async function createCustomerAction(input: CustomerInput): Promise<ActionResult> {
  const fieldErrors = validate(input);
  if (Object.keys(fieldErrors).length > 0) return { error: "Revisa los campos.", fieldErrors };

  const session = await getSessionContext();
  if (!session?.activeCompany) return { error: "No encontramos tu negocio activo." };

  const supabase = await createClient();
  const limitCheck = await checkPlanLimit(supabase, session.activeCompany.id, "max_customers");
  if (!limitCheck.ok) return { error: limitCheck.error };

  const { data, error } = await supabase
    .from("customers")
    .insert({
      company_id: session.activeCompany.id,
      first_name: input.firstName.trim(),
      last_name: input.lastName.trim() || null,
      phone: input.phone.trim() || null,
      email: input.email.trim() || null,
      address: input.address.trim() || null,
      city: input.city.trim() || null,
      notes: input.notes.trim() || null,
    })
    .select("id")
    .single();

  if (error || !data) return { error: "No pudimos crear el cliente." };

  revalidatePath("/clientes");
  revalidatePath("/dashboard");
  return { ok: true, id: data.id };
}

export async function updateCustomerAction(
  id: string,
  input: CustomerInput,
): Promise<ActionResult> {
  const fieldErrors = validate(input);
  if (Object.keys(fieldErrors).length > 0) return { error: "Revisa los campos.", fieldErrors };

  const supabase = await createClient();
  const { error } = await supabase
    .from("customers")
    .update({
      first_name: input.firstName.trim(),
      last_name: input.lastName.trim() || null,
      phone: input.phone.trim() || null,
      email: input.email.trim() || null,
      address: input.address.trim() || null,
      city: input.city.trim() || null,
      notes: input.notes.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) return { error: "No pudimos guardar los cambios." };

  revalidatePath("/clientes");
  revalidatePath(`/clientes/${id}`);
  return { ok: true, id };
}

export async function setCustomerStatusAction(
  id: string,
  status: EntityStatus,
): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("customers")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return { error: "No pudimos actualizar el estado." };

  revalidatePath("/clientes");
  revalidatePath(`/clientes/${id}`);
  return { ok: true };
}

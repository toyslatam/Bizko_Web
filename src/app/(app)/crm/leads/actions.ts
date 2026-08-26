"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/lib/auth/session";
import { checkPlanLimit } from "@/lib/subscription";
import { can } from "@/lib/permissions";
import type { LeadSource } from "@/types/database";

export interface LeadInput {
  name: string;
  phone: string;
  email: string;
  companyName: string;
  source: LeadSource;
  productInterest: string;
  potentialValue: string;
}

type ActionResult =
  | { ok: true; id: string }
  | { error: string; fieldErrors?: Partial<Record<"name", string>> };

function parseMoneyToCents(value: string): number | null {
  const normalized = value.replace(/,/g, ".").trim();
  if (normalized === "") return null;
  const n = Number(normalized);
  if (Number.isNaN(n) || n < 0) return null;
  return Math.round(n * 100);
}

function validate(input: LeadInput) {
  const fieldErrors: Partial<Record<"name", string>> = {};
  if (!input.name.trim()) fieldErrors.name = "El nombre es obligatorio.";
  return fieldErrors;
}

export async function createLeadAction(input: LeadInput): Promise<ActionResult> {
  const fieldErrors = validate(input);
  if (Object.keys(fieldErrors).length > 0) return { error: "Revisa los campos.", fieldErrors };

  const session = await getSessionContext();
  if (!session?.activeCompany || !session.activeMembership) return { error: "No encontramos tu negocio activo." };
  if (!can(session.activeMembership.role, "crm.gestionar")) {
    return { error: "No tienes permiso para gestionar el CRM." };
  }

  const supabase = await createClient();
  const limitCheck = await checkPlanLimit(supabase, session.activeCompany.id, "max_leads");
  if (!limitCheck.ok) return { error: limitCheck.error };

  const { data, error } = await supabase
    .rpc("create_lead", {
      p_company_id: session.activeCompany.id,
      p_name: input.name.trim(),
      p_phone: input.phone.trim() || null,
      p_email: input.email.trim() || null,
      p_company_name: input.companyName.trim() || null,
      p_source: input.source,
      p_product_interest: input.productInterest.trim() || null,
      p_potential_value_cents: parseMoneyToCents(input.potentialValue),
    })
    .single();

  if (error || !data) return { error: error?.message || "No pudimos crear el lead." };

  revalidatePath("/crm/leads");
  revalidatePath("/dashboard");
  return { ok: true, id: (data as { id: string }).id };
}

export async function updateLeadAction(id: string, input: LeadInput): Promise<ActionResult> {
  const fieldErrors = validate(input);
  if (Object.keys(fieldErrors).length > 0) return { error: "Revisa los campos.", fieldErrors };

  const session = await getSessionContext();
  if (!session?.activeMembership) return { error: "No encontramos tu sesión." };
  if (!can(session.activeMembership.role, "crm.gestionar")) {
    return { error: "No tienes permiso para gestionar el CRM." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("leads")
    .update({
      name: input.name.trim(),
      phone: input.phone.trim() || null,
      email: input.email.trim() || null,
      company_name: input.companyName.trim() || null,
      source: input.source,
      product_interest: input.productInterest.trim() || null,
      potential_value_cents: parseMoneyToCents(input.potentialValue),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) return { error: "No pudimos guardar los cambios." };

  revalidatePath("/crm/leads");
  revalidatePath(`/crm/leads/${id}`);
  return { ok: true, id };
}

export async function moveLeadStageAction(
  leadId: string,
  stageId: string,
): Promise<{ ok: true } | { error: string }> {
  const session = await getSessionContext();
  if (!session?.activeMembership) return { error: "No encontramos tu sesión." };
  if (!can(session.activeMembership.role, "crm.gestionar")) {
    return { error: "No tienes permiso para gestionar el CRM." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .rpc("move_lead_stage", { p_lead_id: leadId, p_stage_id: stageId })
    .single();

  if (error) return { error: error.message || "No pudimos mover el lead." };

  revalidatePath("/crm/leads");
  revalidatePath(`/crm/leads/${leadId}`);
  return { ok: true };
}

export async function convertLeadToCustomerAction(
  leadId: string,
): Promise<{ ok: true; customerId: string } | { error: string }> {
  const session = await getSessionContext();
  if (!session?.activeMembership) return { error: "No encontramos tu sesión." };
  if (!can(session.activeMembership.role, "crm.gestionar")) {
    return { error: "No tienes permiso para gestionar el CRM." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("convert_lead_to_customer", { p_lead_id: leadId })
    .single();

  if (error || !data) return { error: error?.message || "No pudimos convertir el lead." };

  revalidatePath("/crm/leads");
  revalidatePath(`/crm/leads/${leadId}`);
  revalidatePath("/clientes");
  return { ok: true, customerId: (data as { id: string }).id };
}

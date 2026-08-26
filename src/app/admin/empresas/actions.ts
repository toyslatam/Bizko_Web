"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { SubscriptionStatus } from "@/types/database";

type ActionResult = { ok: true } | { error: string };

function revalidateCompany(companyId: string) {
  revalidatePath("/admin/empresas");
  revalidatePath(`/admin/empresas/${companyId}`);
}

export async function changeCompanyPlanAction(
  companyId: string,
  newPlanId: string,
  reason: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_change_plan", {
    p_company_id: companyId,
    p_new_plan_id: newPlanId,
    p_reason: reason.trim() || null,
  });
  if (error) return { error: "No pudimos cambiar el plan." };

  revalidateCompany(companyId);
  return { ok: true };
}

export async function startTrialAction(companyId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_start_trial", {
    p_company_id: companyId,
    p_days: 14,
  });
  if (error) return { error: "No pudimos iniciar la prueba." };

  revalidateCompany(companyId);
  return { ok: true };
}

export async function extendTrialAction(companyId: string, days: number): Promise<ActionResult> {
  if (!Number.isFinite(days) || days <= 0) return { error: "Ingresa un número de días válido." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_extend_trial", {
    p_company_id: companyId,
    p_days: days,
  });
  if (error) return { error: "No pudimos extender la prueba." };

  revalidateCompany(companyId);
  return { ok: true };
}

export async function endTrialAction(companyId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_end_trial", {
    p_company_id: companyId,
    p_new_status: "active" satisfies SubscriptionStatus,
  });
  if (error) return { error: "No pudimos finalizar la prueba." };

  revalidateCompany(companyId);
  return { ok: true };
}

export async function suspendCompanyAction(companyId: string, reason: string): Promise<ActionResult> {
  if (!reason.trim()) return { error: "Selecciona un motivo de suspensión." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_suspend_company", {
    p_company_id: companyId,
    p_reason: reason,
  });
  if (error) return { error: "No pudimos suspender la empresa." };

  revalidateCompany(companyId);
  return { ok: true };
}

export async function reactivateCompanyAction(companyId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_reactivate_company", {
    p_company_id: companyId,
    p_reason: null,
  });
  if (error) return { error: "No pudimos reactivar la empresa." };

  revalidateCompany(companyId);
  return { ok: true };
}

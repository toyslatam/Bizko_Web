import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PlanLimitKey, PlanUsageRow } from "@/types/database";
import { PLAN_LIMIT_LABELS } from "@/lib/plans";

export type LimitCheckResult = { ok: true } | { ok: false; error: string };

/**
 * Consulta get_plan_usage() (Postgres, agregación eficiente) y decide si la
 * empresa puede crear una entidad más de `limitKey`. Server-side siempre —
 * nunca confiar en un chequeo hecho solo en el cliente (Fase 11 §21).
 */
export async function checkPlanLimit(
  supabase: SupabaseClient,
  companyId: string,
  limitKey: PlanLimitKey,
): Promise<LimitCheckResult> {
  const { data } = await supabase.rpc("get_plan_usage", { p_company_id: companyId });
  const rows = (data as PlanUsageRow[] | null) ?? [];
  const row = rows.find((r) => r.limit_key === limitKey);
  if (!row || row.limit_value === null) return { ok: true };
  if (row.current_usage >= row.limit_value) {
    return {
      ok: false,
      error: `Has alcanzado el límite de ${PLAN_LIMIT_LABELS[limitKey].toLowerCase()} de tu plan (${row.limit_value}). Administra tu plan para ampliar este límite.`,
    };
  }
  return { ok: true };
}

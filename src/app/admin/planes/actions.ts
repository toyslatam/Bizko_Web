"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { FeatureKey, PlanLimitKey } from "@/types/database";

export interface UpdatePlanInput {
  name: string;
  description: string;
  priceMonthlyCents: number;
  priceYearlyCents: number;
  isActive: boolean;
  isRecommended: boolean;
}

type ActionResult = { ok: true } | { error: string };

export async function updatePlanAction(planId: string, input: UpdatePlanInput): Promise<ActionResult> {
  if (!input.name.trim()) return { error: "El nombre es obligatorio." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("plans")
    .update({
      name: input.name.trim(),
      description: input.description.trim(),
      price_monthly_cents: input.priceMonthlyCents,
      price_yearly_cents: input.priceYearlyCents,
      is_active: input.isActive,
      is_recommended: input.isRecommended,
      updated_at: new Date().toISOString(),
    })
    .eq("id", planId);

  if (error) return { error: "No pudimos guardar los cambios del plan." };

  revalidatePath("/admin/planes");
  return { ok: true };
}

export async function togglePlanFeatureAction(
  planId: string,
  featureKey: FeatureKey,
  enabled: boolean,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("plan_features")
    .upsert({ plan_id: planId, feature_key: featureKey, enabled }, { onConflict: "plan_id,feature_key" });

  if (error) return { error: "No pudimos actualizar la función." };

  revalidatePath("/admin/planes");
  return { ok: true };
}

export async function updatePlanLimitsAction(
  planId: string,
  limits: { limitKey: PlanLimitKey; value: number | null }[],
): Promise<ActionResult> {
  const supabase = await createClient();
  const rows = limits.map((l) => ({ plan_id: planId, limit_key: l.limitKey, limit_value: l.value }));
  const { error } = await supabase.from("plan_limits").upsert(rows, { onConflict: "plan_id,limit_key" });

  if (error) return { error: "No pudimos guardar los límites." };

  revalidatePath("/admin/planes");
  return { ok: true };
}

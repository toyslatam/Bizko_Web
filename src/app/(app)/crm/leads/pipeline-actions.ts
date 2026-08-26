"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/lib/auth/session";
import { can } from "@/lib/permissions";

type ActionResult = { ok: true } | { error: string };

export async function createStageAction(name: string): Promise<ActionResult> {
  if (!name.trim()) return { error: "El nombre es obligatorio." };

  const session = await getSessionContext();
  if (!session?.activeCompany || !session.activeMembership) return { error: "No encontramos tu sesión." };
  if (!can(session.activeMembership.role, "crm.gestionar")) {
    return { error: "No tienes permiso para gestionar el CRM." };
  }

  const supabase = await createClient();
  const { data: last } = await supabase
    .from("crm_pipeline_stages")
    .select("sort_order")
    .eq("company_id", session.activeCompany.id)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextOrder = ((last?.sort_order as number | undefined) ?? -1) + 1;

  const { error } = await supabase.from("crm_pipeline_stages").insert({
    company_id: session.activeCompany.id,
    name: name.trim(),
    sort_order: nextOrder,
  });

  if (error) return { error: "No pudimos crear la etapa." };

  revalidatePath("/crm/leads");
  return { ok: true };
}

export async function updateStageAction(
  id: string,
  input: { name: string; isWon: boolean; isLost: boolean },
): Promise<ActionResult> {
  if (!input.name.trim()) return { error: "El nombre es obligatorio." };

  const session = await getSessionContext();
  if (!session?.activeMembership) return { error: "No encontramos tu sesión." };
  if (!can(session.activeMembership.role, "crm.gestionar")) {
    return { error: "No tienes permiso para gestionar el CRM." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("crm_pipeline_stages")
    .update({ name: input.name.trim(), is_won: input.isWon, is_lost: input.isLost })
    .eq("id", id);

  if (error) return { error: "No pudimos guardar la etapa." };

  revalidatePath("/crm/leads");
  return { ok: true };
}

export async function deleteStageAction(id: string): Promise<ActionResult> {
  const session = await getSessionContext();
  if (!session?.activeMembership) return { error: "No encontramos tu sesión." };
  if (!can(session.activeMembership.role, "crm.gestionar")) {
    return { error: "No tienes permiso para gestionar el CRM." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("crm_pipeline_stages").delete().eq("id", id);

  if (error) {
    return { error: "No pudimos eliminar la etapa. Verifica que no tenga leads asignados." };
  }

  revalidatePath("/crm/leads");
  return { ok: true };
}

export async function moveStageAction(
  id: string,
  direction: "up" | "down",
): Promise<ActionResult> {
  const session = await getSessionContext();
  if (!session?.activeCompany || !session.activeMembership) return { error: "No encontramos tu sesión." };
  if (!can(session.activeMembership.role, "crm.gestionar")) {
    return { error: "No tienes permiso para gestionar el CRM." };
  }

  const supabase = await createClient();
  const { data: stages } = await supabase
    .from("crm_pipeline_stages")
    .select("id, sort_order")
    .eq("company_id", session.activeCompany.id)
    .order("sort_order", { ascending: true });

  const list = (stages ?? []) as { id: string; sort_order: number }[];
  const index = list.findIndex((s) => s.id === id);
  const swapIndex = direction === "up" ? index - 1 : index + 1;
  if (index === -1 || swapIndex < 0 || swapIndex >= list.length) return { ok: true };

  const current = list[index];
  const target = list[swapIndex];

  const [{ error: error1 }, { error: error2 }] = await Promise.all([
    supabase.from("crm_pipeline_stages").update({ sort_order: target.sort_order }).eq("id", current.id),
    supabase.from("crm_pipeline_stages").update({ sort_order: current.sort_order }).eq("id", target.id),
  ]);

  if (error1 || error2) return { error: "No pudimos reordenar el pipeline." };

  revalidatePath("/crm/leads");
  return { ok: true };
}

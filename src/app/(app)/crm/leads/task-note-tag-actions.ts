"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/lib/auth/session";
import { can } from "@/lib/permissions";

export type CrmOwner = { leadId: string; customerId?: never } | { customerId: string; leadId?: never };

type ActionResult = { ok: true } | { error: string };
type ActionResultWithId = { ok: true; id: string } | { error: string };

function revalidateOwner(owner: CrmOwner) {
  if (owner.leadId) revalidatePath(`/crm/leads/${owner.leadId}`);
  if (owner.customerId) revalidatePath(`/clientes/${owner.customerId}`);
}

type CrmAuthResult =
  | { ok: false; error: string }
  | { ok: true; companyId: string; userId: string };

async function requireCrmSession(): Promise<CrmAuthResult> {
  const session = await getSessionContext();
  if (!session?.activeCompany || !session.activeMembership) {
    return { ok: false, error: "No encontramos tu sesión." };
  }
  if (!can(session.activeMembership.role, "crm.gestionar")) {
    return { ok: false, error: "No tienes permiso para gestionar el CRM." };
  }
  return { ok: true, companyId: session.activeCompany.id, userId: session.userId };
}

export async function createTaskAction(
  owner: CrmOwner,
  input: { title: string; dueAt: string | null },
): Promise<ActionResultWithId> {
  if (!input.title.trim()) return { error: "El título es obligatorio." };

  const auth = await requireCrmSession();
  if (!auth.ok) return { error: auth.error };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("crm_tasks")
    .insert({
      company_id: auth.companyId,
      lead_id: owner.leadId ?? null,
      customer_id: owner.customerId ?? null,
      title: input.title.trim(),
      due_at: input.dueAt,
      created_by: auth.userId,
    })
    .select("id")
    .single();

  if (error || !data) return { error: "No pudimos crear la tarea." };

  revalidateOwner(owner);
  return { ok: true, id: data.id };
}

export async function toggleTaskDoneAction(
  owner: CrmOwner,
  taskId: string,
  done: boolean,
): Promise<ActionResult> {
  const auth = await requireCrmSession();
  if (!auth.ok) return { error: auth.error };

  const supabase = await createClient();
  const { error } = await supabase
    .from("crm_tasks")
    .update({ done_at: done ? new Date().toISOString() : null })
    .eq("id", taskId);

  if (error) return { error: "No pudimos actualizar la tarea." };

  revalidateOwner(owner);
  return { ok: true };
}

export async function createNoteAction(owner: CrmOwner, body: string): Promise<ActionResultWithId> {
  if (!body.trim()) return { error: "La nota no puede estar vacía." };

  const auth = await requireCrmSession();
  if (!auth.ok) return { error: auth.error };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("crm_notes")
    .insert({
      company_id: auth.companyId,
      lead_id: owner.leadId ?? null,
      customer_id: owner.customerId ?? null,
      body: body.trim(),
      created_by: auth.userId,
    })
    .select("id")
    .single();

  if (error || !data) return { error: "No pudimos guardar la nota." };

  revalidateOwner(owner);
  return { ok: true, id: data.id };
}

export async function addTagAction(owner: CrmOwner, tagName: string): Promise<ActionResult> {
  const name = tagName.trim();
  if (!name) return { error: "El nombre de la etiqueta es obligatorio." };

  const auth = await requireCrmSession();
  if (!auth.ok) return { error: auth.error };

  const supabase = await createClient();

  const { data: existingTag } = await supabase
    .from("crm_tags")
    .select("id")
    .eq("company_id", auth.companyId)
    .eq("name", name)
    .maybeSingle();

  let tagId = (existingTag as { id: string } | null)?.id;

  if (!tagId) {
    const { data: createdTag, error: createTagError } = await supabase
      .from("crm_tags")
      .insert({ company_id: auth.companyId, name })
      .select("id")
      .single();
    if (createTagError || !createdTag) return { error: "No pudimos crear la etiqueta." };
    tagId = createdTag.id;
  }

  const { error } = await supabase.from("crm_tag_links").insert({
    tag_id: tagId,
    lead_id: owner.leadId ?? null,
    customer_id: owner.customerId ?? null,
  });

  if (error) {
    if (error.code === "23505") return { ok: true };
    return { error: "No pudimos asignar la etiqueta." };
  }

  revalidateOwner(owner);
  return { ok: true };
}

export async function removeTagAction(owner: CrmOwner, tagId: string): Promise<ActionResult> {
  const auth = await requireCrmSession();
  if (!auth.ok) return { error: auth.error };

  const supabase = await createClient();
  let query = supabase.from("crm_tag_links").delete().eq("tag_id", tagId);
  query = owner.leadId ? query.eq("lead_id", owner.leadId) : query.eq("customer_id", owner.customerId as string);
  const { error } = await query;

  if (error) return { error: "No pudimos quitar la etiqueta." };

  revalidateOwner(owner);
  return { ok: true };
}

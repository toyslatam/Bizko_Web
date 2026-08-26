"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { checkPlanLimit } from "@/lib/subscription";
import { channelToLeadSource } from "@/lib/crm-channels";
import type { CrmChannelType, CrmConversationStatus } from "@/types/database";

type ActionResult<T = { ok: true }> = T | { error: string };

export interface RegisterConversationInput {
  contactName: string;
  channelType: CrmChannelType;
  contactHandle: string;
  message: string;
}

function splitName(fullName: string): { firstName: string; lastName: string | null } {
  const trimmed = fullName.trim();
  const spaceIndex = trimmed.indexOf(" ");
  if (spaceIndex === -1) return { firstName: trimmed, lastName: null };
  return { firstName: trimmed.slice(0, spaceIndex), lastName: trimmed.slice(spaceIndex + 1).trim() || null };
}

export async function registerConversationAction(
  input: RegisterConversationInput,
): Promise<ActionResult<{ ok: true; id: string }>> {
  if (!input.contactName.trim()) return { error: "El nombre del contacto es obligatorio." };
  if (!input.message.trim()) return { error: "Registra al menos un mensaje." };

  const session = await getSessionContext();
  if (!session?.activeMembership) return { error: "No encontramos tu sesión." };
  if (!can(session.activeMembership.role, "crm.gestionar")) {
    return { error: "No tienes permiso para gestionar el CRM." };
  }

  const supabase = await createClient();
  const companyId = session.activeMembership.company_id;
  const body = input.message.trim();

  const { data: conversation, error: conversationError } = await supabase
    .from("crm_conversations")
    .insert({
      company_id: companyId,
      channel_type: input.channelType,
      contact_name: input.contactName.trim(),
      contact_handle: input.contactHandle.trim() || null,
      status: "open",
      last_message_at: new Date().toISOString(),
      last_message_preview: body.slice(0, 200),
    })
    .select("id")
    .single();

  if (conversationError || !conversation) {
    return { error: "No pudimos registrar la conversación." };
  }

  const { error: messageError } = await supabase.from("crm_messages").insert({
    conversation_id: conversation.id,
    direction: "inbound",
    body,
  });

  if (messageError) {
    return { error: "La conversación se creó, pero no pudimos guardar el mensaje." };
  }

  revalidatePath("/crm/bandeja");
  return { ok: true, id: conversation.id };
}

export async function setConversationStatusAction(
  conversationId: string,
  status: CrmConversationStatus,
): Promise<ActionResult> {
  const session = await getSessionContext();
  if (!session?.activeMembership) return { error: "No encontramos tu sesión." };
  if (!can(session.activeMembership.role, "crm.gestionar")) {
    return { error: "No tienes permiso para gestionar el CRM." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("crm_conversations")
    .update({ status })
    .eq("id", conversationId);

  if (error) return { error: "No pudimos actualizar el estado de la conversación." };

  revalidatePath("/crm/bandeja");
  revalidatePath(`/crm/bandeja/${conversationId}`);
  return { ok: true };
}

export async function logOutboundMessageAction(
  conversationId: string,
  body: string,
): Promise<ActionResult> {
  const trimmed = body.trim();
  if (!trimmed) return { error: "Escribe un mensaje." };

  const session = await getSessionContext();
  if (!session?.activeMembership) return { error: "No encontramos tu sesión." };
  if (!can(session.activeMembership.role, "crm.gestionar")) {
    return { error: "No tienes permiso para gestionar el CRM." };
  }

  const supabase = await createClient();
  const { error: messageError } = await supabase.from("crm_messages").insert({
    conversation_id: conversationId,
    direction: "outbound",
    body: trimmed,
    sender_id: session.userId,
  });

  if (messageError) return { error: "No pudimos registrar el mensaje." };

  const { error: conversationError } = await supabase
    .from("crm_conversations")
    .update({ last_message_at: new Date().toISOString(), last_message_preview: trimmed.slice(0, 200) })
    .eq("id", conversationId);

  if (conversationError) return { error: "No pudimos actualizar la conversación." };

  revalidatePath(`/crm/bandeja/${conversationId}`);
  revalidatePath("/crm/bandeja");
  return { ok: true };
}

export async function convertConversationToLeadAction(
  conversationId: string,
): Promise<ActionResult<{ ok: true; leadId: string }>> {
  const session = await getSessionContext();
  if (!session?.activeMembership) return { error: "No encontramos tu sesión." };
  if (!can(session.activeMembership.role, "crm.gestionar")) {
    return { error: "No tienes permiso para gestionar el CRM." };
  }

  const supabase = await createClient();
  const companyId = session.activeMembership.company_id;

  const { data: conversation } = await supabase
    .from("crm_conversations")
    .select("id, contact_name, channel_type, lead_id")
    .eq("id", conversationId)
    .maybeSingle();

  if (!conversation) return { error: "No encontramos la conversación." };
  if (conversation.lead_id) return { error: "Esta conversación ya está vinculada a un lead." };

  const limitCheck = await checkPlanLimit(supabase, companyId, "max_leads");
  if (!limitCheck.ok) return { error: limitCheck.error };

  const { data: lead, error: leadError } = await supabase
    .rpc("create_lead", {
      p_company_id: companyId,
      p_name: conversation.contact_name,
      p_phone: null,
      p_email: null,
      p_company_name: null,
      p_source: channelToLeadSource(conversation.channel_type),
      p_product_interest: null,
      p_potential_value_cents: null,
    })
    .single();

  if (leadError || !lead) {
    return { error: leadError?.message || "No pudimos crear el lead." };
  }

  const createdLead = lead as { id: string };
  const { error: linkError } = await supabase
    .from("crm_conversations")
    .update({ lead_id: createdLead.id })
    .eq("id", conversationId);

  if (linkError) return { error: "El lead se creó, pero no pudimos vincularlo a la conversación." };

  revalidatePath("/crm/bandeja");
  revalidatePath(`/crm/bandeja/${conversationId}`);
  revalidatePath("/crm/leads");
  return { ok: true, leadId: createdLead.id };
}

export async function convertConversationToCustomerAction(
  conversationId: string,
): Promise<ActionResult<{ ok: true; customerId: string }>> {
  const session = await getSessionContext();
  if (!session?.activeMembership) return { error: "No encontramos tu sesión." };
  if (!can(session.activeMembership.role, "crm.gestionar")) {
    return { error: "No tienes permiso para gestionar el CRM." };
  }

  const supabase = await createClient();
  const companyId = session.activeMembership.company_id;

  const { data: conversation } = await supabase
    .from("crm_conversations")
    .select("id, contact_name, channel_type, customer_id")
    .eq("id", conversationId)
    .maybeSingle();

  if (!conversation) return { error: "No encontramos la conversación." };
  if (conversation.customer_id) return { error: "Esta conversación ya está vinculada a un cliente." };

  const limitCheck = await checkPlanLimit(supabase, companyId, "max_customers");
  if (!limitCheck.ok) return { error: limitCheck.error };

  const { firstName, lastName } = splitName(conversation.contact_name);
  const { data: customer, error: customerError } = await supabase
    .from("customers")
    .insert({
      company_id: companyId,
      first_name: firstName,
      last_name: lastName,
      source: channelToLeadSource(conversation.channel_type),
    })
    .select("id")
    .single();

  if (customerError || !customer) return { error: "No pudimos crear el cliente." };

  const { error: linkError } = await supabase
    .from("crm_conversations")
    .update({ customer_id: customer.id })
    .eq("id", conversationId);

  if (linkError) return { error: "El cliente se creó, pero no pudimos vincularlo a la conversación." };

  revalidatePath("/crm/bandeja");
  revalidatePath(`/crm/bandeja/${conversationId}`);
  revalidatePath("/clientes");
  return { ok: true, customerId: customer.id };
}

export async function createTaskFromConversationAction(
  conversationId: string,
  title: string,
  dueAt: string | null,
): Promise<ActionResult> {
  if (!title.trim()) return { error: "El título de la tarea es obligatorio." };

  const session = await getSessionContext();
  if (!session?.activeMembership) return { error: "No encontramos tu sesión." };
  if (!can(session.activeMembership.role, "crm.gestionar")) {
    return { error: "No tienes permiso para gestionar el CRM." };
  }

  const supabase = await createClient();
  const companyId = session.activeMembership.company_id;

  const { data: conversation } = await supabase
    .from("crm_conversations")
    .select("id, lead_id, customer_id")
    .eq("id", conversationId)
    .maybeSingle();

  if (!conversation) return { error: "No encontramos la conversación." };
  if (!conversation.lead_id && !conversation.customer_id) {
    return { error: "Convierte esta conversación en lead o cliente antes de crear una tarea." };
  }

  const { error } = await supabase.from("crm_tasks").insert({
    company_id: companyId,
    lead_id: conversation.lead_id,
    customer_id: conversation.lead_id ? null : conversation.customer_id,
    title: title.trim(),
    due_at: dueAt,
    created_by: session.userId,
  });

  if (error) return { error: "No pudimos crear la tarea." };

  revalidatePath(`/crm/bandeja/${conversationId}`);
  revalidatePath("/crm/leads");
  return { ok: true };
}

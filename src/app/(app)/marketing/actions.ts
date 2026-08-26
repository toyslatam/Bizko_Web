"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/lib/auth/session";
import { nextCampaignStatus, previousCampaignStatus } from "@/lib/marketing";
import type {
  CampaignAudienceType,
  CampaignContentType,
  CampaignObjective,
  CampaignStatus,
  CrmChannelType,
  MarketingCampaign,
  SegmentConditionType,
} from "@/types/database";

type ActionResult<T = undefined> =
  | { ok: true; id: string; data?: T }
  | { error: string; fieldErrors?: Record<string, string> };

export interface CampaignInput {
  name: string;
  objective: CampaignObjective;
  audienceType: CampaignAudienceType;
  audienceConfig: Record<string, unknown>;
  channels: CrmChannelType[];
}

export async function createCampaignAction(input: CampaignInput): Promise<ActionResult> {
  if (!input.name.trim()) {
    return { error: "Revisa los campos.", fieldErrors: { name: "El nombre es obligatorio." } };
  }
  if (input.channels.length === 0) {
    return { error: "Revisa los campos.", fieldErrors: { channels: "Selecciona al menos un canal." } };
  }

  const session = await getSessionContext();
  if (!session?.activeCompany) return { error: "No encontramos tu negocio activo." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("marketing_campaigns")
    .insert({
      company_id: session.activeCompany.id,
      name: input.name.trim(),
      objective: input.objective,
      audience_type: input.audienceType,
      audience_config: input.audienceConfig,
      channels: input.channels,
      created_by: session.userId,
    })
    .select("id")
    .single();

  if (error || !data) return { error: "No pudimos crear la campaña." };

  revalidatePath("/marketing/campanas");
  return { ok: true, id: data.id };
}

type StatusActionResult =
  | { ok: true; campaign: MarketingCampaign }
  | { error: string };

export async function setCampaignStatusAction(
  campaignId: string,
  status: CampaignStatus,
): Promise<StatusActionResult> {
  const session = await getSessionContext();
  if (!session?.activeCompany) return { error: "No encontramos tu negocio activo." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("set_campaign_status", {
    p_campaign_id: campaignId,
    p_status: status,
  });

  if (error || !data) return { error: error?.message ?? "No pudimos cambiar el estado de la campaña." };

  const campaign = data as MarketingCampaign;

  if (status === "published") {
    try {
      await supabase.rpc("spend_marketing_credits", {
        p_company_id: session.activeCompany.id,
        p_action_type: "campaign",
        p_reference_type: "campaign",
        p_reference_id: campaignId,
      });
    } catch {
      // Los créditos son una métrica secundaria — nunca bloquean el flujo principal de la campaña.
    }
  }

  revalidatePath("/marketing/campanas");
  revalidatePath(`/marketing/campanas/${campaignId}`);
  revalidatePath("/marketing/creditos");
  revalidatePath("/marketing");
  return { ok: true, campaign };
}

export async function advanceCampaignAction(
  campaignId: string,
  currentStatus: CampaignStatus,
): Promise<StatusActionResult> {
  const next = nextCampaignStatus(currentStatus);
  if (!next) return { error: "Esta campaña ya está en el último estado." };
  return setCampaignStatusAction(campaignId, next);
}

export async function retreatCampaignAction(
  campaignId: string,
  currentStatus: CampaignStatus,
): Promise<StatusActionResult> {
  const prev = previousCampaignStatus(currentStatus);
  if (!prev) return { error: "Esta campaña ya está en el primer estado." };
  return setCampaignStatusAction(campaignId, prev);
}

export async function setCampaignScheduleAction(
  campaignId: string,
  scheduledAt: string,
): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("marketing_campaigns")
    .update({ scheduled_at: scheduledAt, updated_at: new Date().toISOString() })
    .eq("id", campaignId);

  if (error) return { error: "No pudimos guardar la fecha programada." };

  revalidatePath(`/marketing/campanas/${campaignId}`);
  revalidatePath("/marketing/calendario");
  return { ok: true };
}

export interface CampaignContentInput {
  channel: CrmChannelType | null;
  contentType: CampaignContentType;
  body: string;
  mediaUrl: string | null;
}

export async function addCampaignContentAction(
  campaignId: string,
  input: CampaignContentInput,
): Promise<ActionResult> {
  if (!input.body.trim()) {
    return { error: "Revisa los campos.", fieldErrors: { body: "Escribe el contenido." } };
  }

  const session = await getSessionContext();
  if (!session?.activeCompany) return { error: "No encontramos tu negocio activo." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("marketing_campaign_content")
    .insert({
      campaign_id: campaignId,
      channel: input.channel,
      content_type: input.contentType,
      body: input.body.trim(),
      media_url: input.mediaUrl?.trim() || null,
      generated_by: "manual",
      created_by: session.userId,
    })
    .select("id")
    .single();

  if (error || !data) return { error: "No pudimos guardar el contenido." };

  revalidatePath(`/marketing/campanas/${campaignId}`);
  return { ok: true, id: data.id };
}

export interface SegmentInput {
  name: string;
  conditionType: SegmentConditionType;
  conditionValue: Record<string, unknown>;
}

export async function createSegmentAction(input: SegmentInput): Promise<ActionResult> {
  if (!input.name.trim()) {
    return { error: "Revisa los campos.", fieldErrors: { name: "El nombre es obligatorio." } };
  }

  const session = await getSessionContext();
  if (!session?.activeCompany) return { error: "No encontramos tu negocio activo." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("marketing_segments")
    .insert({
      company_id: session.activeCompany.id,
      name: input.name.trim(),
      condition_type: input.conditionType,
      condition_value: input.conditionValue,
    })
    .select("id")
    .single();

  if (error || !data) return { error: "No pudimos crear el segmento." };

  revalidatePath("/marketing/segmentos");
  return { ok: true, id: data.id };
}

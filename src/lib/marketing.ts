import type {
  CampaignAudienceType,
  CampaignContentType,
  CampaignObjective,
  CampaignStatus,
  MarketingCreditAction,
  SegmentConditionType,
} from "@/types/database";

export const CAMPAIGN_OBJECTIVE_LABELS: Record<CampaignObjective, string> = {
  generate_leads: "Generar leads",
  sell_product: "Vender un producto",
  launch_product: "Lanzar un producto",
  recover_customers: "Recuperar clientes",
  increase_ticket: "Aumentar el ticket promedio",
  promote_season: "Promocionar temporada",
  increase_visits: "Aumentar visitas",
  loyalty: "Fidelizar clientes",
};

export const CAMPAIGN_AUDIENCE_LABELS: Record<CampaignAudienceType, string> = {
  all_customers: "Todos los clientes",
  new_customers: "Clientes nuevos",
  frequent_customers: "Clientes frecuentes",
  inactive_customers: "Clientes inactivos",
  category_buyers: "Compradores de una categoría",
  product_buyers: "Compradores de un producto",
  leads: "Leads",
  custom_segment: "Segmento personalizado",
};

export const CAMPAIGN_STATUS_LABELS: Record<CampaignStatus, string> = {
  draft: "Borrador",
  review: "Revisión",
  approved: "Aprobada",
  scheduled: "Programada",
  published: "Publicada",
  finished: "Finalizada",
};

/** Único flujo válido — igual al de `set_campaign_status()` en 0026_marketing.sql. */
export const CAMPAIGN_STATUS_FLOW: CampaignStatus[] = [
  "draft",
  "review",
  "approved",
  "scheduled",
  "published",
  "finished",
];

export const CAMPAIGN_CONTENT_TYPE_LABELS: Record<CampaignContentType, string> = {
  post: "Publicación",
  caption: "Descripción/caption",
  whatsapp_message: "Mensaje de WhatsApp",
  ad: "Anuncio",
  story: "Historia",
  title: "Título",
  cta: "Llamado a la acción",
};

export const SEGMENT_CONDITION_LABELS: Record<SegmentConditionType, string> = {
  purchased_last_days: "Compró en los últimos N días",
  inactive_days: "Inactivo hace N días",
  category_id: "Compró de una categoría",
  min_total_spent: "Gastó al menos un monto",
  lead_source: "Vino de un canal de origen",
};

export const MARKETING_CREDIT_ACTION_LABELS: Record<MarketingCreditAction, string> = {
  content: "Contenido",
  image: "Imagen",
  video: "Video",
  campaign: "Campaña publicada",
};

export function campaignStatusFlowIndex(status: CampaignStatus): number {
  return CAMPAIGN_STATUS_FLOW.indexOf(status);
}

export function nextCampaignStatus(status: CampaignStatus): CampaignStatus | null {
  const idx = campaignStatusFlowIndex(status);
  return idx >= 0 && idx < CAMPAIGN_STATUS_FLOW.length - 1 ? CAMPAIGN_STATUS_FLOW[idx + 1] : null;
}

export function previousCampaignStatus(status: CampaignStatus): CampaignStatus | null {
  const idx = campaignStatusFlowIndex(status);
  return idx > 0 ? CAMPAIGN_STATUS_FLOW[idx - 1] : null;
}

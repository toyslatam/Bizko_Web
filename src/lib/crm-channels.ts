import {
  MessageCircle,
  Camera,
  ThumbsUp,
  Briefcase,
  Mail,
  Globe,
  type LucideIcon,
} from "lucide-react";
import type { CrmChannelType, CrmConversationStatus, LeadSource } from "@/types/database";

export const CHANNEL_TYPE_LABELS: Record<CrmChannelType, string> = {
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  facebook: "Facebook",
  linkedin: "LinkedIn",
  email: "Email",
  web: "Web",
};

export const CHANNEL_TYPE_ICONS: Record<CrmChannelType, LucideIcon> = {
  whatsapp: MessageCircle,
  instagram: Camera,
  facebook: ThumbsUp,
  linkedin: Briefcase,
  email: Mail,
  web: Globe,
};

export const CONVERSATION_STATUS_LABELS: Record<CrmConversationStatus, string> = {
  open: "Abierta",
  pending: "Pendiente",
  closed: "Cerrada",
};

export const CHANNEL_TYPES: CrmChannelType[] = [
  "whatsapp",
  "instagram",
  "facebook",
  "linkedin",
  "email",
  "web",
];

export const CONVERSATION_STATUSES: CrmConversationStatus[] = ["open", "pending", "closed"];

/**
 * Qué falta para conectar cada canal de verdad (Fase CRM/Marketing — "No
 * simular integraciones inexistentes"). `web` no es un canal de chat: ya es
 * el formulario/checkout del catálogo público, que genera leads solo.
 */
export const CHANNEL_CONNECT_INFO: Record<CrmChannelType, string> = {
  whatsapp: "Requiere Meta Business API y aprobación de Meta.",
  instagram: "Requiere Meta Business API y aprobación de Meta.",
  facebook: "Requiere Meta Business API y aprobación de Meta.",
  linkedin: "Requiere LinkedIn API.",
  email: "Requiere un proveedor de email transaccional.",
  web: "El formulario del catálogo público ya genera leads automáticamente — no requiere conexión.",
};

/** Mapea el canal de una conversación al `lead_source` más cercano al convertirla en lead/cliente. */
export function channelToLeadSource(channel: CrmChannelType): LeadSource {
  switch (channel) {
    case "whatsapp":
      return "whatsapp";
    case "instagram":
      return "instagram";
    case "facebook":
      return "facebook";
    case "linkedin":
      return "linkedin";
    case "web":
      return "website";
    default:
      return "manual";
  }
}

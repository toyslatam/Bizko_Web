import type { LeadSource } from "@/types/database";

export const LEAD_SOURCE_LABELS: Record<LeadSource, string> = {
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  facebook: "Facebook",
  linkedin: "LinkedIn",
  website: "Sitio web",
  form: "Formulario",
  catalog: "Catálogo bizko",
  referral: "Referido",
  manual: "Registro manual",
};

/** Días transcurridos desde una fecha ISO — usado para "última interacción" en el pipeline. */
export function daysSince(iso: string): number {
  const diffMs = Date.now() - new Date(iso).getTime();
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

export function formatDaysSince(iso: string): string {
  const days = daysSince(iso);
  if (days === 0) return "Hoy";
  if (days === 1) return "Hace 1 día";
  return `Hace ${days} días`;
}

import { formatCurrencyCents, formatUsdCents, formatUsdCentsAsCop } from "@/lib/format";
import type { Plan, PlanLimitKey, PlanUsageRow, SubscriptionStatus } from "@/types/database";

/**
 * Features y límites ya NO están hardcodeados aquí (Fase 11 §1/§6/§7/§8) —
 * viven en las tablas `plans`, `features`, `plan_features` y `plan_limits`,
 * consultadas server-side vía las RPC `get_active_feature_keys()` y
 * `get_plan_usage()`. Este archivo solo tiene helpers de presentación puros
 * (labels, formato) que no dependen de qué plan tenga cada negocio.
 */

export const SUBSCRIPTION_STATUS_LABELS: Record<SubscriptionStatus, string> = {
  trial: "Prueba",
  active: "Activa",
  past_due: "Pago pendiente",
  canceled: "Cancelada",
  expired: "Vencida",
  suspended: "Suspendida",
};

/** Si el negocio puede operar con normalidad (más allá del aviso que se le muestre). */
export function subscriptionIsOperational(status: SubscriptionStatus): boolean {
  return status === "trial" || status === "active" || status === "past_due" || status === "canceled";
}

/** `suspended`/`expired` bloquean la operación del negocio pero nunca se borran datos (Fase 11 §15). */
export function subscriptionIsBlocked(status: SubscriptionStatus): boolean {
  return status === "suspended" || status === "expired";
}

export const PLAN_LIMIT_LABELS: Record<PlanLimitKey, string> = {
  max_users: "Usuarios",
  max_products: "Productos",
  max_customers: "Clientes",
  max_orders_month: "Pedidos este mes",
  max_storage_mb: "Almacenamiento",
  max_ai_queries_month: "Consultas IA este mes",
  max_automations_active: "Automatizaciones activas",
  max_leads: "Leads",
  max_marketing_credits_month: "Créditos de marketing este mes",
};

export function formatLimitValue(limitKey: PlanLimitKey, value: number | null): string {
  if (value === null) return "Ilimitado";
  if (limitKey === "max_storage_mb") return value >= 1000 ? `${(value / 1000).toFixed(1)} GB` : `${value} MB`;
  return String(value);
}

/** `null` = ilimitado, nunca "al límite". */
export function usagePct(row: Pick<PlanUsageRow, "limit_value" | "current_usage">): number | null {
  if (row.limit_value === null || row.limit_value <= 0) return null;
  return Math.min(100, Math.round((row.current_usage / row.limit_value) * 100));
}

export function isAtLimit(usage: PlanUsageRow[], limitKey: PlanLimitKey): boolean {
  const row = usage.find((u) => u.limit_key === limitKey);
  if (!row || row.limit_value === null) return false;
  return row.current_usage >= row.limit_value;
}

/** Precio mensual de un plan, moneda-aware (Fase 11 §26 — nunca hardcodeado, viene de `plans.currency`). */
export function formatPlanPrice(plan: Pick<Plan, "price_monthly_cents" | "currency">): {
  primary: string;
  secondary: string | null;
} {
  if (plan.price_monthly_cents === 0) return { primary: "Gratis", secondary: null };
  if (plan.currency === "USD") {
    return {
      primary: formatUsdCents(plan.price_monthly_cents),
      secondary: formatUsdCentsAsCop(plan.price_monthly_cents),
    };
  }
  return { primary: formatCurrencyCents(plan.price_monthly_cents), secondary: null };
}

export function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  return Math.ceil(ms / 86400000);
}

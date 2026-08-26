import type { OrderFulfillment, OrderPaymentStatus, OrderStatus } from "@/types/database";

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "Pendiente",
  confirmed: "Confirmado",
  preparing: "Preparando",
  ready: "Listo",
  out_for_delivery: "En entrega",
  delivered: "Entregado",
  canceled: "Cancelado",
};

export const PAYMENT_STATUS_LABELS: Record<OrderPaymentStatus, string> = {
  pending: "Pago pendiente",
  paid: "Pagado",
  canceled: "Cancelado",
};

export const DELIVERY_TYPE_LABELS: Record<OrderFulfillment, string> = {
  pickup: "Recoger en el negocio",
  delivery: "Entrega a domicilio",
  dine_in: "En mesa",
};

/**
 * Flujo del ESTADO DEL PEDIDO según el tipo de entrega (ver Fase 7 §14).
 * Desde la Fase 8, "recoger" avanza directo hasta Entregado; "domicilio" se
 * detiene en Listo — desde ahí el estado del DELIVERY (asignar, en camino,
 * entregado) es el que controla el resto, ver DELIVERY_STATUS_FLOW en
 * src/lib/delivery.ts. No se mezclan los dos conceptos. "En mesa" (Fase
 * Restaurantes §28) salta "confirmado" — el mesero ya confirmó al enviarlo a
 * cocina.
 */
export const ORDER_STATUS_FLOW: Record<OrderFulfillment, OrderStatus[]> = {
  pickup: ["pending", "confirmed", "preparing", "ready", "delivered"],
  delivery: ["pending", "confirmed", "preparing", "ready"],
  dine_in: ["pending", "preparing", "ready", "delivered"],
};

/** Siguiente estado sugerido en el flujo (null si ya es el último o está cancelado). */
export function nextOrderStatus(current: OrderStatus, fulfillment: OrderFulfillment): OrderStatus | null {
  const flow = ORDER_STATUS_FLOW[fulfillment];
  const index = flow.indexOf(current);
  if (index === -1 || index === flow.length - 1) return null;
  return flow[index + 1];
}

export function canCancelOrder(status: OrderStatus): boolean {
  return status !== "delivered" && status !== "canceled";
}

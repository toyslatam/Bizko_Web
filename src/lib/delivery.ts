import type { DeliveryDriverStatus, DeliveryStatus } from "@/types/database";

export const DELIVERY_STATUS_LABELS: Record<DeliveryStatus, string> = {
  not_applicable: "No aplica",
  pending_assignment: "Pendiente de asignación",
  assigned: "Asignado",
  picked_up: "Recogido",
  on_the_way: "En camino",
  delivered: "Entregado",
  failed: "Fallido",
};

export const DELIVERY_STATUS_FLOW: DeliveryStatus[] = [
  "pending_assignment",
  "assigned",
  "picked_up",
  "on_the_way",
  "delivered",
];

export function nextDeliveryStatus(current: DeliveryStatus): DeliveryStatus | null {
  const index = DELIVERY_STATUS_FLOW.indexOf(current);
  if (index === -1 || index === DELIVERY_STATUS_FLOW.length - 1) return null;
  return DELIVERY_STATUS_FLOW[index + 1];
}

export const DRIVER_STATUS_LABELS: Record<DeliveryDriverStatus, string> = {
  available: "Disponible",
  busy: "Ocupado",
  inactive: "Inactivo",
};

export const DELIVERY_FAILURE_REASONS = [
  "Cliente no estaba",
  "Dirección incorrecta",
  "Cliente canceló",
  "No se pudo contactar",
  "Otro",
] as const;

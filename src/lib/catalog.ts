import type {
  AppointmentStatus,
  Customer,
  EntityStatus,
  LaundryOrderStatus,
  ProductUnit,
  WorkOrderStatus,
} from "@/types/database";

export const UNIT_LABELS: Record<ProductUnit, string> = {
  unidad: "Unidad",
  kg: "Kilogramo",
  g: "Gramo",
  libra: "Libra",
  litro: "Litro",
  ml: "Mililitro",
  metro: "Metro",
  servicio: "Servicio",
};

export const UNIT_SHORT_LABELS: Record<ProductUnit, string> = {
  unidad: "und.",
  kg: "kg",
  g: "g",
  libra: "lb",
  litro: "L",
  ml: "ml",
  metro: "m",
  servicio: "serv.",
};

export const STATUS_LABELS: Record<EntityStatus, string> = {
  active: "Activo",
  inactive: "Inactivo",
};

export const APPOINTMENT_STATUS_LABELS: Record<AppointmentStatus, string> = {
  pending: "Pendiente",
  confirmed: "Confirmada",
  completed: "Completada",
  canceled: "Cancelada",
  no_show: "No asistió",
};

export const LAUNDRY_ORDER_STATUS_LABELS: Record<LaundryOrderStatus, string> = {
  received: "Recibido",
  in_process: "En proceso",
  ready: "Listo",
  delivered: "Entregado",
  canceled: "Cancelado",
};

export const WORK_ORDER_STATUS_LABELS: Record<WorkOrderStatus, string> = {
  received: "Recibido",
  diagnosis: "Diagnóstico",
  in_repair: "En reparación",
  waiting_parts: "Esperando repuestos",
  ready: "Listo",
  delivered: "Entregado",
  canceled: "Cancelado",
};

export function customerFullName(customer: Pick<Customer, "first_name" | "last_name">) {
  return [customer.first_name, customer.last_name].filter(Boolean).join(" ");
}

export function customerInitials(customer: Pick<Customer, "first_name" | "last_name">) {
  const name = customerFullName(customer);
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

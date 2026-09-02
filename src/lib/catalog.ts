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

/** SKU sugerido a partir del nombre del producto — ej. "Camiseta Halloween Jason" -> "CAM-HAL-JAS". */
export function generateSkuFromName(name: string): string {
  const words = name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 0) return "";
  return words
    .slice(0, 3)
    .map((w) => w.slice(0, 3))
    .join("-");
}

/** Negro o blanco, el que tenga mejor contraste sobre este color de fondo (WCAG luminancia relativa). */
export function readableForeground(hexColor: string): "#0a0a0a" | "#ffffff" {
  const hex = hexColor.replace("#", "");
  if (hex.length !== 6) return "#ffffff";
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [lr, lg, lb] = [r, g, b].map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  const luminance = 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
  return luminance > 0.5 ? "#0a0a0a" : "#ffffff";
}

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

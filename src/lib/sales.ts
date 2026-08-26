import type { PaymentMethod, SaleSource, SaleStatus } from "@/types/database";

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: "Efectivo",
  transfer: "Transferencia",
  card: "Tarjeta",
  cash_on_delivery: "Contra entrega",
};

export const SALE_STATUS_LABELS: Record<SaleStatus, string> = {
  completed: "Completada",
  voided: "Anulada",
};

export const SALE_SOURCE_LABELS: Record<SaleSource, string> = {
  pos: "POS",
  menu: "Menú",
  delivery: "Domicilio",
  table: "Mesa",
  takeout: "Para llevar",
};

export const GENERAL_CUSTOMER_VALUE = "general";

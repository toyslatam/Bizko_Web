import type { InventoryMovementType, Product } from "@/types/database";

export type StockStatus = "available" | "low" | "out";

export function stockStatus(product: Pick<Product, "current_stock" | "minimum_stock">): StockStatus {
  if (product.current_stock <= 0) return "out";
  if (product.current_stock <= product.minimum_stock) return "low";
  return "available";
}

export const STOCK_STATUS_LABELS: Record<StockStatus, string> = {
  available: "Disponible",
  low: "Stock bajo",
  out: "Agotado",
};

export const MOVEMENT_TYPE_LABELS: Record<InventoryMovementType, string> = {
  in: "Entrada",
  out: "Salida",
  adjustment: "Ajuste",
  return: "Devolución",
};

export const ADJUSTMENT_REASONS = [
  "Conteo físico",
  "Producto dañado",
  "Pérdida",
  "Error de registro",
  "Otro",
] as const;

export const OUT_REASONS = [
  "Producto dañado",
  "Consumo interno",
  "Pérdida",
  "Otro",
] as const;

/** Formatea una cantidad decimal sin ceros de más (2.50 -> "2.5", 3.00 -> "3"). */
export function formatQuantity(value: number): string {
  return new Intl.NumberFormat("es-CO", { maximumFractionDigits: 3 }).format(value);
}

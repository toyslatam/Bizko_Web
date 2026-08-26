import type { VariantAttribute } from "@/types/database";

/** Atributos comunes sugeridos — la arquitectura no se limita a estos (Fase 9 §12). */
export const COMMON_ATTRIBUTE_NAMES = ["Talla", "Color", "Material", "Tamaño"] as const;

export function variantLabel(attributes: Pick<VariantAttribute, "attribute_name" | "attribute_value">[]): string {
  return attributes.map((a) => a.attribute_value).join(" / ") || "Variante";
}

export function groupAttributesByVariant<T extends { variant_id: string }>(rows: T[]): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const list = map.get(row.variant_id) ?? [];
    list.push(row);
    map.set(row.variant_id, list);
  }
  return map;
}

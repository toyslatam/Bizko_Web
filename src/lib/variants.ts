import type { VariantAttribute } from "@/types/database";

/** Atributos comunes sugeridos — la arquitectura no se limita a estos (Fase 9 §12). */
export const COMMON_ATTRIBUTE_NAMES = ["Talla", "Color", "Material", "Tamaño"] as const;

/** Valores sugeridos por atributo (boutique/tienda de ropa) — seleccionables pero editables, no una lista cerrada. */
export const SUGGESTED_ATTRIBUTE_VALUES: Record<string, string[]> = {
  Talla: ["XS", "S", "M", "L", "XL", "XXL", "XXXL", "Único"],
  Color: [
    "Negro", "Blanco", "Gris", "Azul", "Azul oscuro", "Rojo", "Verde", "Amarillo",
    "Rosado", "Café", "Beige", "Morado", "Naranja", "Vino tinto",
  ],
};

function abbreviate(value: string): string {
  const clean = value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  return clean.length <= 3 ? clean : clean.slice(0, 3);
}

/** SKU sugerido para una variante — ej. "Camiseta Halloween" + Talla M + Color Negro -> "CAM-M-NEG". */
export function generateVariantSku(
  productName: string,
  attributes: { name: string; value: string }[],
): string {
  const firstWord = productName.trim().split(/\s+/)[0] ?? "";
  const base = abbreviate(firstWord);
  const parts = attributes.map((a) => abbreviate(a.value)).filter(Boolean);
  return [base, ...parts].filter(Boolean).join("-");
}

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

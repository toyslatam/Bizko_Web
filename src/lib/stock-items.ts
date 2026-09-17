import { variantLabel } from "@/lib/variants";
import type { Product, ProductVariant, VariantAttribute } from "@/types/database";

/**
 * Unidad seleccionable en un movimiento de inventario.
 *
 * Un producto sin variantes mueve `products.current_stock`; uno con variantes
 * mueve `product_variants.stock`. El diálogo de movimientos trabaja siempre con
 * esta forma para no tener que distinguir los dos casos en la UI.
 */
export interface StockItem {
  /** Identificador dentro del combobox: el de la variante si la hay. */
  key: string;
  productId: string;
  variantId: string | null;
  /** "Camisa Urbana" o "Camisa Urbana · M / Negro". */
  label: string;
  stock: number;
  unit: Product["unit"];
}

export function buildStockItems({
  products,
  variantProducts,
  attributesByVariant,
}: {
  /** Productos sin variantes y con control de inventario activado. */
  products: Product[];
  variantProducts: (Product & { product_variants: ProductVariant[] })[];
  attributesByVariant: Map<string, VariantAttribute[]>;
}): StockItem[] {
  const simple: StockItem[] = products.map((p) => ({
    key: p.id,
    productId: p.id,
    variantId: null,
    label: p.name,
    stock: p.current_stock,
    unit: p.unit,
  }));

  const fromVariants: StockItem[] = variantProducts.flatMap((p) =>
    p.product_variants
      .filter((v) => v.status === "active")
      .map((v) => ({
        key: v.id,
        productId: p.id,
        variantId: v.id,
        label: `${p.name} · ${variantLabel(attributesByVariant.get(v.id) ?? [])}`,
        stock: v.stock,
        unit: p.unit,
      })),
  );

  return [...simple, ...fromVariants].sort((a, b) => a.label.localeCompare(b.label, "es"));
}

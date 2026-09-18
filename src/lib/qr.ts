import { variantLabel } from "@/lib/variants";
import type { Product, ProductVariant, VariantAttribute } from "@/types/database";

/**
 * Ruta que codifica el QR de un producto. Se resuelve contra el origin del
 * navegador, no contra una variable de entorno, para que el mismo código
 * funcione en producción, en preview y en local.
 *
 * El QR lleva solo identificadores: el precio se lee de la base al escanear,
 * así que cambiarlo no invalida los códigos ya impresos (sí conviene
 * reimprimir la etiqueta, que lleva el precio en papel).
 */
export function qrPathFor(productId: string, variantId?: string | null): string {
  return variantId ? `/qr/${productId}?v=${variantId}` : `/qr/${productId}`;
}

export interface QrLabel {
  key: string;
  href: string;
  name: string;
  /** Talla/color u otra característica; vacío si el producto no tiene variantes. */
  detail: string;
  imageUrl: string | null;
  priceCents: number;
}

/**
 * Una etiqueta por producto, o una por variante activa cuando las tiene:
 * cada talla/color tiene su propio precio, su propio stock y su propia foto.
 */
export function buildQrLabels({
  product,
  variants,
  attributesByVariant,
  origin,
}: {
  product: Product;
  variants: ProductVariant[];
  attributesByVariant: Map<string, VariantAttribute[]>;
  origin: string;
}): QrLabel[] {
  if (!product.has_variants) {
    return [
      {
        key: product.id,
        href: origin + qrPathFor(product.id),
        name: product.name,
        detail: "",
        imageUrl: product.image_url,
        priceCents: product.price_cents,
      },
    ];
  }

  return variants
    .filter((v) => v.status === "active")
    .map((v) => ({
      key: v.id,
      href: origin + qrPathFor(product.id, v.id),
      name: product.name,
      detail: variantLabel(attributesByVariant.get(v.id) ?? []),
      // La variante puede traer su propia foto; si no, hereda la del producto.
      imageUrl: v.image_url ?? product.image_url,
      priceCents: v.price_cents,
    }));
}

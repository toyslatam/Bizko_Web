import type { Product, ProductVariant } from "@/types/database";

/**
 * Ruta que codifica el QR de un producto. Se resuelve contra el origin del
 * navegador, no contra una variable de entorno, para que el mismo código
 * funcione en producción, en preview y en local.
 *
 * El QR lleva solo identificadores: el precio se lee de la base al escanear,
 * así que cambiarlo no invalida los códigos ya impresos (sí conviene
 * reimprimir la etiqueta, que lleva el precio en papel).
 *
 * `variantId` ya no se usa al generar etiquetas —un producto tiene un único
 * QR y la variante se elige al confirmar la venta— pero se sigue aceptando
 * para que los códigos impresos con el esquema anterior sigan funcionando:
 * al escanearlos, llegan con la variante ya seleccionada.
 */
export function qrPathFor(productId: string, variantId?: string | null): string {
  return variantId ? `/qr/${productId}?v=${variantId}` : `/qr/${productId}`;
}

export interface QrLabel {
  key: string;
  href: string;
  name: string;
  /** "3 variantes" cuando las tiene; vacío si no. */
  detail: string;
  imageUrl: string | null;
  priceCents: number;
  /** Solo cuando las variantes valen distinto: la etiqueta muestra un rango. */
  priceMaxCents: number | null;
}

/**
 * Una sola etiqueta por producto, tenga variantes o no: es un único producto
 * en la estantería y llevar cinco stickers en el mismo frasco no tiene
 * sentido. Al escanear, quien vende elige la talla o el color.
 */
export function buildQrLabels({
  product,
  variants,
  origin,
}: {
  product: Product;
  variants: ProductVariant[];
  origin: string;
}): QrLabel[] {
  const active = variants.filter((v) => v.status === "active");

  if (!product.has_variants || active.length === 0) {
    return [
      {
        key: product.id,
        href: origin + qrPathFor(product.id),
        name: product.name,
        detail: "",
        imageUrl: product.image_url,
        priceCents: product.price_cents,
        priceMaxCents: null,
      },
    ];
  }

  const prices = active.map((v) => v.price_cents);
  const min = Math.min(...prices);
  const max = Math.max(...prices);

  return [
    {
      key: product.id,
      href: origin + qrPathFor(product.id),
      name: product.name,
      detail: `${active.length} variantes`,
      imageUrl: product.image_url ?? active[0].image_url,
      priceCents: min,
      priceMaxCents: max > min ? max : null,
    },
  ];
}

/** Variante seleccionable al confirmar una venta escaneada. */
export interface QrVariantOption {
  id: string;
  /** "M / Negro" */
  label: string;
  priceCents: number;
  stock: number;
  imageUrl: string | null;
}

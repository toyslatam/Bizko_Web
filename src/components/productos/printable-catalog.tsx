"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { ArrowLeft, Package, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrencyCents } from "@/lib/format";
import { qrPathFor } from "@/lib/qr";
import { UNIT_SHORT_LABELS } from "@/lib/catalog";
import { formatQuantity } from "@/lib/inventory";
import type { Product, ProductVariant } from "@/types/database";

export interface CatalogEntry {
  product: Product;
  categoryName: string | null;
  /** Solo variantes activas; vacío si el producto no tiene. */
  variants: ProductVariant[];
}

/** "$ 15.000" o "$ 15.000 – $ 18.000" cuando los valores difieren. */
function centsRange(values: number[]): string {
  const min = Math.min(...values);
  const max = Math.max(...values);
  return max > min
    ? `${formatCurrencyCents(min)} – ${formatCurrencyCents(max)}`
    : formatCurrencyCents(min);
}

export function PrintableCatalog({
  companyName,
  entries,
  variantLabels,
}: {
  companyName: string;
  entries: CatalogEntry[];
  /** variantId -> "M / Negro" */
  variantLabels: Record<string, string>;
}) {
  const [origin, setOrigin] = React.useState("");

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOrigin(window.location.origin);
  }, []);

  return (
    <div className="mx-auto w-full max-w-5xl p-6">
      {/*
        `@page { margin: 0 }` evita el encabezado y pie del navegador (fecha,
        URL, número de página). `break-inside: avoid` impide que una ficha se
        parta entre dos hojas, que es justo el "recorte" a evitar.
      */}
      <style>{`
        @media print {
          @page { margin: 0; }
          .no-print { display: none !important; }
          .catalog { padding: 10mm; }
          .catalog-entry { break-inside: avoid; page-break-inside: avoid; }
        }
      `}</style>

      <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/productos">
              <ArrowLeft /> Volver a productos
            </Link>
          </Button>
          <h1 className="mt-2 font-heading text-xl font-semibold text-foreground">
            Catálogo · {companyName}
          </h1>
          <p className="text-sm text-muted-foreground">
            {entries.length === 1 ? "1 producto" : `${entries.length} productos`}
          </p>
        </div>

        <Button onClick={() => window.print()}>
          <Printer /> Imprimir
        </Button>
      </div>

      {entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No hay productos que coincidan con los filtros.
        </p>
      ) : (
        <div className="catalog grid grid-cols-1 gap-4 md:grid-cols-2">
          {entries.map(({ product, categoryName, variants }) => {
            const hasVariants = variants.length > 0;
            const priceLabel = hasVariants
              ? centsRange(variants.map((v) => v.price_cents))
              : formatCurrencyCents(product.price_cents);

            return (
              <div
                key={product.id}
                className="catalog-entry flex flex-col gap-3 rounded-xl border border-border bg-card p-4"
              >
                <div className="flex gap-3">
                  {/* object-contain: el producto entero, nunca recortado. */}
                  <div className="relative size-24 shrink-0 overflow-hidden rounded-lg bg-muted">
                    {product.image_url ? (
                      <Image
                        src={product.image_url}
                        alt={product.name}
                        fill
                        sizes="96px"
                        className="object-contain"
                      />
                    ) : (
                      <div className="flex size-full items-center justify-center">
                        <Package className="size-6 text-muted-foreground" />
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="font-heading text-base font-semibold text-foreground">
                      {product.name}
                    </p>
                    {categoryName && (
                      <p className="text-xs text-muted-foreground">{categoryName}</p>
                    )}
                    {product.sku && (
                      <p className="text-xs text-muted-foreground">SKU {product.sku}</p>
                    )}
                    <p className="mt-1 font-heading text-lg font-semibold text-foreground">
                      {priceLabel}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      por {UNIT_SHORT_LABELS[product.unit]}
                    </p>
                  </div>

                  <div className="shrink-0">
                    {origin ? (
                      <QRCodeSVG
                        value={origin + qrPathFor(product.id)}
                        size={88}
                        level="M"
                        marginSize={1}
                      />
                    ) : (
                      <div className="size-[88px]" />
                    )}
                  </div>
                </div>

                {hasVariants && (
                  <div className="rounded-lg bg-muted/50 p-2.5">
                    <p className="mb-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                      {variants.length} variantes
                    </p>
                    <ul className="space-y-1">
                      {variants.map((variant) => (
                        <li
                          key={variant.id}
                          className="flex items-baseline justify-between gap-2 text-xs"
                        >
                          <span className="min-w-0 flex-1 text-foreground">
                            {variantLabels[variant.id] || "Variante"}
                          </span>
                          <span className="shrink-0 text-muted-foreground">
                            {formatCurrencyCents(variant.price_cents)}
                          </span>
                          <span className="w-16 shrink-0 text-right text-muted-foreground">
                            {formatQuantity(variant.stock)} {UNIT_SHORT_LABELS[product.unit]}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {product.description && (
                  <p className="text-xs text-muted-foreground">{product.description}</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

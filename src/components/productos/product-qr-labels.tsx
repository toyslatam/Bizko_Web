"use client";

import * as React from "react";
import { QRCodeSVG } from "qrcode.react";
import { Printer, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrencyCents } from "@/lib/format";
import { variantLabel } from "@/lib/variants";
import { qrPathFor } from "@/lib/qr";
import type { Product, ProductVariant, VariantAttribute } from "@/types/database";

interface LabelData {
  key: string;
  href: string;
  name: string;
  /** Talla/color u otra característica; vacío si el producto no tiene variantes. */
  detail: string;
  priceCents: number;
}

/**
 * Etiquetas imprimibles: un QR por producto, o uno por variante activa cuando
 * las tiene (cada talla/color vale un precio distinto, así que necesita su
 * propia etiqueta). El QR apunta a /qr/..., que registra la venta.
 *
 * La URL se arma en el cliente con `window.location.origin` para que el código
 * sirva en el dominio donde realmente está corriendo la app, igual que hace el
 * enlace del catálogo en Configuración.
 */
export function ProductQrLabels({
  product,
  variants,
  attributesByVariant,
}: {
  product: Product;
  variants: ProductVariant[];
  attributesByVariant: Map<string, VariantAttribute[]>;
}) {
  const [origin, setOrigin] = React.useState("");

  React.useEffect(() => {
    // window.location solo existe en el cliente; el servidor renderiza la
    // ruta relativa y esto la completa con el origen tras el montaje —
    // mismo patrón que el enlace del catálogo en company-settings-form.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOrigin(window.location.origin);
  }, []);

  const activeVariants = variants.filter((v) => v.status === "active");

  const labels: LabelData[] = product.has_variants
    ? activeVariants.map((v) => ({
        key: v.id,
        href: origin + qrPathFor(product.id, v.id),
        name: product.name,
        detail: variantLabel(attributesByVariant.get(v.id) ?? []),
        priceCents: v.price_cents,
      }))
    : [
        {
          key: product.id,
          href: origin + qrPathFor(product.id),
          name: product.name,
          detail: "",
          priceCents: product.price_cents,
        },
      ];

  if (labels.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Agrega al menos una variante activa para generar sus códigos QR.
      </p>
    );
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between print:hidden">
        <p className="text-sm text-muted-foreground">
          {labels.length === 1
            ? "Imprime esta etiqueta y pégala en el producto o la estantería."
            : `${labels.length} etiquetas, una por variante.`}
        </p>
        <Button variant="outline" size="sm" onClick={() => window.print()}>
          <Printer /> Imprimir
        </Button>
      </div>

      <div
        id="qr-labels"
        className="grid grid-cols-[repeat(auto-fill,minmax(210px,1fr))] gap-3"
      >
        {labels.map((label) => (
          <div
            key={label.key}
            className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card p-4 text-center break-inside-avoid"
          >
            {origin ? (
              <QRCodeSVG value={label.href} size={132} level="M" marginSize={1} />
            ) : (
              // Reserva el espacio hasta que el cliente conozca el origin, para
              // que la etiqueta no salte al montar.
              <div className="flex size-[132px] items-center justify-center text-muted-foreground">
                <QrCode className="size-8" />
              </div>
            )}
            <p className="text-sm font-medium text-foreground">{label.name}</p>
            {label.detail && <p className="text-xs text-muted-foreground">{label.detail}</p>}
            <p className="font-heading text-lg font-semibold text-foreground">
              {formatCurrencyCents(label.priceCents)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

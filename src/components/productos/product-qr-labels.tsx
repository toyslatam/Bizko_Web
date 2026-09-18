"use client";

import * as React from "react";
import Link from "next/link";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { QrLabelCard } from "@/components/productos/qr-label-card";
import { buildQrLabels } from "@/lib/qr";
import type { Product, ProductVariant, VariantAttribute } from "@/types/database";

/**
 * Vista previa de las etiquetas dentro de la ficha del producto. Imprimir
 * abre /etiquetas/[id], una página sin navegación: intentar imprimir desde
 * acá salían seis hojas, porque ocultar el resto de la app con `visibility`
 * no le quita el espacio que ocupa.
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

  const labels = buildQrLabels({ product, variants, attributesByVariant, origin });

  if (labels.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Agrega al menos una variante activa para generar sus códigos QR.
      </p>
    );
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {labels.length === 1
            ? "Imprime esta etiqueta y pégala en el producto o la estantería."
            : `${labels.length} etiquetas, una por variante.`}
        </p>
        <Button variant="outline" size="sm" asChild>
          <Link href={`/etiquetas/${product.id}`} target="_blank">
            <Printer /> Imprimir
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(210px,1fr))] gap-3">
        {labels.map((label) => (
          <QrLabelCard key={label.key} label={label} />
        ))}
      </div>
    </div>
  );
}

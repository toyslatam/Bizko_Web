"use client";

import * as React from "react";
import Link from "next/link";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { QrLabelCard } from "@/components/productos/qr-label-card";
import { buildQrLabel } from "@/lib/qr";
import type { Product, ProductVariant } from "@/types/database";

/**
 * Vista previa de la etiqueta dentro de la ficha del producto. Imprimir abre
 * /etiquetas/[id], una página sin navegación: intentar imprimir desde acá
 * salían seis hojas, porque ocultar el resto de la app con `visibility` no le
 * quita el espacio que ocupa.
 */
export function ProductQrLabels({
  product,
  variants,
}: {
  product: Product;
  variants: ProductVariant[];
}) {
  const [origin, setOrigin] = React.useState("");

  React.useEffect(() => {
    // window.location solo existe en el cliente; el servidor renderiza la
    // ruta relativa y esto la completa con el origen tras el montaje —
    // mismo patrón que el enlace del catálogo en company-settings-form.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOrigin(window.location.origin);
  }, []);

  const label = buildQrLabel({ product, variants, origin });

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {product.has_variants
            ? "Un solo código para el producto: al escanearlo se elige la variante."
            : "Imprime esta etiqueta y pégala en el producto o la estantería."}
        </p>
        <Button variant="outline" size="sm" asChild>
          <Link href={`/etiquetas/${product.id}`} target="_blank">
            <Printer /> Imprimir
          </Link>
        </Button>
      </div>

      <div className="max-w-[240px]">
        <QrLabelCard label={label} />
      </div>
    </div>
  );
}

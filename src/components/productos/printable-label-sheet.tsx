"use client";

import * as React from "react";
import { ArrowLeft, Printer } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { QrLabelCard } from "@/components/productos/qr-label-card";
import { buildQrLabel } from "@/lib/qr";
import type { Product, ProductVariant } from "@/types/database";

export function PrintableLabelSheet({
  product,
  variants,
}: {
  product: Product;
  variants: ProductVariant[];
}) {
  const [origin, setOrigin] = React.useState("");

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOrigin(window.location.origin);
  }, []);

  const label = buildQrLabel({ product, variants, origin });

  return (
    <div className="mx-auto w-full max-w-4xl p-6">
      {/*
        `@page { margin: 0 }` es lo que hace que Chrome no imprima su propio
        encabezado y pie — la fecha, el título de la pestaña y la URL que
        salían en el papel.
      */}
      <style>{`
        @media print {
          @page { margin: 0; }
          .no-print { display: none !important; }
          .label-sheet { padding: 6mm; }
        }
      `}</style>

      <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/productos/${product.id}`}>
              <ArrowLeft /> Volver al producto
            </Link>
          </Button>
          <h1 className="mt-2 font-heading text-xl font-semibold text-foreground">
            Etiqueta · {product.name}
          </h1>
          <p className="text-sm text-muted-foreground">
            Para imprimir varias copias, usa el campo &quot;Copias&quot; del diálogo de
            impresión.
          </p>
        </div>

        <Button onClick={() => window.print()}>
          <Printer /> Imprimir
        </Button>
      </div>

      <div className="label-sheet max-w-[240px]">
        <QrLabelCard label={label} />
      </div>
    </div>
  );
}

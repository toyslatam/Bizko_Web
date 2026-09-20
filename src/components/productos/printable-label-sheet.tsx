"use client";

import * as React from "react";
import { ArrowLeft, Printer } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { QrLabelCard } from "@/components/productos/qr-label-card";
import { buildQrLabels } from "@/lib/qr";
import type { Product, ProductVariant } from "@/types/database";

export function PrintableLabelSheet({
  product,
  variants,
}: {
  product: Product;
  variants: ProductVariant[];
}) {
  const [origin, setOrigin] = React.useState("");
  /** Las impresoras de etiquetas (ej. Zebra) tratan cada página como una etiqueta. */
  const [onePerPage, setOnePerPage] = React.useState(false);

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOrigin(window.location.origin);
  }, []);

  const labels = buildQrLabels({ product, variants, origin });

  return (
    <div className="mx-auto w-full max-w-4xl p-6">
      {/*
        `@page { margin: 0 }` es lo que hace que Chrome no imprima su propio
        encabezado y pie — la fecha, el título de la pestaña, la URL y el
        "1/6" que salían en el papel.
      */}
      <style>{`
        @media print {
          @page { margin: 0; }
          .no-print { display: none !important; }
          .label-sheet { padding: 6mm; gap: 6mm; }
          ${onePerPage ? ".label-sheet > * { break-after: page; }" : ""}
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
            Etiquetas · {product.name}
          </h1>
          <p className="text-sm text-muted-foreground">
            {labels.length === 1 ? "1 etiqueta" : `${labels.length} etiquetas`}
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Switch id="onePerPage" checked={onePerPage} onCheckedChange={setOnePerPage} />
            <Label htmlFor="onePerPage" className="text-sm font-normal">
              Una por página
            </Label>
          </div>
          <Button onClick={() => window.print()}>
            <Printer /> Imprimir
          </Button>
        </div>
      </div>

      {labels.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Este producto no tiene variantes activas, así que no hay etiquetas que imprimir.
        </p>
      ) : (
        <div className="label-sheet grid grid-cols-[repeat(auto-fill,minmax(210px,1fr))] gap-3">
          {labels.map((label) => (
            <QrLabelCard key={label.key} label={label} />
          ))}
        </div>
      )}
    </div>
  );
}

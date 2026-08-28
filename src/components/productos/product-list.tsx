import Link from "next/link";
import Image from "next/image";
import { Package } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { MobileList, MobileListItem } from "@/components/ui/mobile-list";
import { StatusBadge } from "@/components/catalog/status-badge";
import { UNIT_SHORT_LABELS } from "@/lib/catalog";
import { formatCurrencyCents } from "@/lib/format";
import type { Product } from "@/types/database";

function formatProductPrice(product: Product, range?: { min: number; max: number }) {
  if (!product.has_variants) return formatCurrencyCents(product.price_cents);
  if (!range) return "Sin variantes aún";
  if (range.min === range.max) return formatCurrencyCents(range.min);
  return `${formatCurrencyCents(range.min)} - ${formatCurrencyCents(range.max)}`;
}

function Thumb({ product }: { product: Product }) {
  return (
    <div className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted">
      {product.image_url ? (
        <Image src={product.image_url} alt="" width={36} height={36} className="size-full object-cover" />
      ) : (
        <Package className="size-4 text-muted-foreground" />
      )}
    </div>
  );
}

export function ProductList({
  products,
  priceRangeByProduct,
}: {
  products: Product[];
  priceRangeByProduct?: Map<string, { min: number; max: number }>;
}) {
  return (
    <>
      <div className="hidden overflow-hidden rounded-xl border border-border md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Producto</TableHead>
              <TableHead>Precio</TableHead>
              <TableHead>Unidad</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium text-foreground">
                  <Link href={`/productos/${p.id}`} className="flex items-center gap-2.5">
                    <Thumb product={p} />
                    {p.name}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatProductPrice(p, priceRangeByProduct?.get(p.id))}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {UNIT_SHORT_LABELS[p.unit]}
                </TableCell>
                <TableCell>
                  <StatusBadge status={p.status} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <MobileList>
        {products.map((p) => (
          <MobileListItem
            key={p.id}
            href={`/productos/${p.id}`}
            title={p.name}
            subtitle={`${formatProductPrice(p, priceRangeByProduct?.get(p.id))} · ${UNIT_SHORT_LABELS[p.unit]}`}
            leading={<Thumb product={p} />}
            trailing={<StatusBadge status={p.status} />}
          />
        ))}
      </MobileList>
    </>
  );
}

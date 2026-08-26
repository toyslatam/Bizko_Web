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

export function ProductList({ products }: { products: Product[] }) {
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
                  {formatCurrencyCents(p.price_cents)}
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
            subtitle={`${formatCurrencyCents(p.price_cents)} · ${UNIT_SHORT_LABELS[p.unit]}`}
            leading={<Thumb product={p} />}
            trailing={<StatusBadge status={p.status} />}
          />
        ))}
      </MobileList>
    </>
  );
}

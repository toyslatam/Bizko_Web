import Link from "next/link";
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
import { StockBadge } from "@/components/inventario/stock-badge";
import { UNIT_SHORT_LABELS } from "@/lib/catalog";
import { formatQuantity } from "@/lib/inventory";
import type { Product, ProductCategory } from "@/types/database";

export function InventoryList({
  products,
  categoriesById,
}: {
  products: Product[];
  categoriesById: Map<string, ProductCategory>;
}) {
  return (
    <>
      <div className="hidden overflow-hidden rounded-xl border border-border md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Producto</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>Categoría</TableHead>
              <TableHead>Existencia</TableHead>
              <TableHead>Mínimo</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium text-foreground">
                  <Link href={`/productos/${p.id}`}>{p.name}</Link>
                </TableCell>
                <TableCell className="text-muted-foreground">{p.sku || "—"}</TableCell>
                <TableCell className="text-muted-foreground">
                  {p.category_id ? (categoriesById.get(p.category_id)?.name ?? "—") : "—"}
                </TableCell>
                <TableCell className="text-foreground">
                  {formatQuantity(p.current_stock)} {UNIT_SHORT_LABELS[p.unit]}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatQuantity(p.minimum_stock)}
                </TableCell>
                <TableCell>
                  <StockBadge product={p} />
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
            subtitle={`${formatQuantity(p.current_stock)} ${UNIT_SHORT_LABELS[p.unit]} · mín. ${formatQuantity(p.minimum_stock)}`}
            leading={
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-muted text-muted-foreground">
                <Package className="size-4" />
              </span>
            }
            trailing={<StockBadge product={p} />}
          />
        ))}
      </MobileList>
    </>
  );
}

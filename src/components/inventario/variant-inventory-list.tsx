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
import { Badge } from "@/components/ui/badge";
import { UNIT_SHORT_LABELS } from "@/lib/catalog";
import { formatQuantity } from "@/lib/inventory";
import type { Product, ProductCategory, ProductVariant } from "@/types/database";

function totalStock(variants: ProductVariant[]): number {
  return variants.filter((v) => v.status === "active").reduce((sum, v) => sum + v.stock, 0);
}

export function VariantInventoryList({
  products,
  categoriesById,
}: {
  products: (Product & { product_variants: ProductVariant[] })[];
  categoriesById: Map<string, ProductCategory>;
}) {
  return (
    <>
      <div className="hidden overflow-hidden rounded-xl border border-border md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Producto</TableHead>
              <TableHead>Categoría</TableHead>
              <TableHead>Variantes</TableHead>
              <TableHead>Existencia total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium text-foreground">
                  <Link href={`/productos/${p.id}`}>{p.name}</Link>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {p.category_id ? (categoriesById.get(p.category_id)?.name ?? "—") : "—"}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  <Badge variant="secondary">
                    {p.product_variants.filter((v) => v.status === "active").length} activas
                  </Badge>
                </TableCell>
                <TableCell className="text-foreground">
                  {formatQuantity(totalStock(p.product_variants))} {UNIT_SHORT_LABELS[p.unit]}
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
            subtitle={`${p.product_variants.filter((v) => v.status === "active").length} variantes activas`}
            leading={
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-muted text-muted-foreground">
                <Package className="size-4" />
              </span>
            }
            trailing={
              <span className="text-sm font-medium text-foreground">
                {formatQuantity(totalStock(p.product_variants))} {UNIT_SHORT_LABELS[p.unit]}
              </span>
            }
          />
        ))}
      </MobileList>
    </>
  );
}

import Link from "next/link";
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
import { customerFullName } from "@/lib/catalog";
import { PAYMENT_METHOD_LABELS, SALE_STATUS_LABELS, SALE_SOURCE_LABELS } from "@/lib/sales";
import { formatCurrencyCents } from "@/lib/format";
import type { Customer, Profile, Sale } from "@/types/database";

export interface SaleRow extends Sale {
  customer: Pick<Customer, "first_name" | "last_name"> | null;
  user: Pick<Profile, "first_name" | "last_name" | "email"> | null;
}

function saleCustomerLabel(sale: SaleRow) {
  return sale.customer ? customerFullName(sale.customer) : "Cliente general";
}

function saleUserLabel(sale: SaleRow) {
  if (!sale.user) return "—";
  const name = [sale.user.first_name, sale.user.last_name].filter(Boolean).join(" ");
  return name || sale.user.email.split("@")[0];
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("es-CO", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function SaleList({ sales }: { sales: SaleRow[] }) {
  return (
    <>
      <div className="hidden overflow-hidden rounded-xl border border-border md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Número</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Usuario</TableHead>
              <TableHead>Método</TableHead>
              <TableHead>Origen</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sales.map((sale) => (
              <TableRow key={sale.id}>
                <TableCell className="font-medium text-foreground">
                  <Link href={`/ventas/${sale.id}`}>{sale.sale_number}</Link>
                </TableCell>
                <TableCell className="text-muted-foreground">{formatDate(sale.created_at)}</TableCell>
                <TableCell className="text-muted-foreground">{saleCustomerLabel(sale)}</TableCell>
                <TableCell className="text-muted-foreground">{saleUserLabel(sale)}</TableCell>
                <TableCell className="text-muted-foreground">
                  {PAYMENT_METHOD_LABELS[sale.payment_method]}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-[10px]">
                    {SALE_SOURCE_LABELS[sale.source]}
                  </Badge>
                </TableCell>
                <TableCell className="font-medium text-foreground">
                  {formatCurrencyCents(sale.total_cents)}
                </TableCell>
                <TableCell>
                  <Badge variant={sale.status === "completed" ? "default" : "outline"}>
                    {SALE_STATUS_LABELS[sale.status]}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <MobileList>
        {sales.map((sale) => (
          <MobileListItem
            key={sale.id}
            href={`/ventas/${sale.id}`}
            title={`${sale.sale_number} · ${saleCustomerLabel(sale)}`}
            subtitle={`${formatDate(sale.created_at)} · ${PAYMENT_METHOD_LABELS[sale.payment_method]} · ${SALE_SOURCE_LABELS[sale.source]}`}
            trailing={
              <div className="flex flex-col items-end gap-1">
                <span className="text-sm font-semibold text-foreground">
                  {formatCurrencyCents(sale.total_cents)}
                </span>
                <Badge variant={sale.status === "completed" ? "default" : "outline"} className="text-[10px]">
                  {SALE_STATUS_LABELS[sale.status]}
                </Badge>
              </div>
            }
          />
        ))}
      </MobileList>
    </>
  );
}

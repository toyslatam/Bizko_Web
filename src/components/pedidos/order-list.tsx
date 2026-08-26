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
import { ORDER_STATUS_LABELS, DELIVERY_TYPE_LABELS } from "@/lib/orders";
import { PAYMENT_METHOD_LABELS } from "@/lib/sales";
import { formatCurrencyCents } from "@/lib/format";
import type { Order, OrderStatus } from "@/types/database";

const STATUS_VARIANT: Record<OrderStatus, "default" | "secondary" | "outline" | "destructive"> = {
  pending: "secondary",
  confirmed: "default",
  preparing: "default",
  ready: "default",
  out_for_delivery: "default",
  delivered: "outline",
  canceled: "destructive",
};

function formatTime(iso: string) {
  return new Date(iso).toLocaleString("es-CO", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function OrderList({ orders }: { orders: Order[] }) {
  return (
    <>
      <div className="hidden overflow-hidden rounded-xl border border-border md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Número</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Hora</TableHead>
              <TableHead>Entrega</TableHead>
              <TableHead>Pago</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.map((o) => (
              <TableRow key={o.id}>
                <TableCell className="font-medium text-foreground">
                  <Link href={`/pedidos/${o.id}`}>{o.order_number}</Link>
                </TableCell>
                <TableCell className="text-muted-foreground">{o.customer_name}</TableCell>
                <TableCell className="text-muted-foreground">{formatTime(o.created_at)}</TableCell>
                <TableCell className="text-muted-foreground">{DELIVERY_TYPE_LABELS[o.fulfillment]}</TableCell>
                <TableCell className="text-muted-foreground">{PAYMENT_METHOD_LABELS[o.payment_method]}</TableCell>
                <TableCell className="font-medium text-foreground">{formatCurrencyCents(o.total_cents)}</TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANT[o.status]}>{ORDER_STATUS_LABELS[o.status]}</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <MobileList>
        {orders.map((o) => (
          <MobileListItem
            key={o.id}
            href={`/pedidos/${o.id}`}
            title={`${o.order_number} · ${o.customer_name}`}
            subtitle={`${formatTime(o.created_at)} · ${DELIVERY_TYPE_LABELS[o.fulfillment]}`}
            trailing={
              <div className="flex flex-col items-end gap-1">
                <span className="text-sm font-semibold text-foreground">{formatCurrencyCents(o.total_cents)}</span>
                <Badge variant={STATUS_VARIANT[o.status]} className="text-[10px]">
                  {ORDER_STATUS_LABELS[o.status]}
                </Badge>
              </div>
            }
          />
        ))}
      </MobileList>
    </>
  );
}

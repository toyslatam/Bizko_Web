import Link from "next/link";
import { Home } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AssignDriverSelect } from "@/components/delivery/assign-driver-select";
import { DELIVERY_STATUS_LABELS } from "@/lib/delivery";
import { PAYMENT_METHOD_LABELS } from "@/lib/sales";
import { formatCurrencyCents } from "@/lib/format";
import type { DeliveryDriver, Order } from "@/types/database";

export function DeliveryOrderCard({
  order,
  zoneName,
  drivers,
}: {
  order: Order;
  zoneName: string | null;
  drivers: DeliveryDriver[];
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
            <Home className="size-4" />
          </span>
          <div>
            <p className="font-medium text-foreground">
              {order.order_number} · {order.customer_name}
            </p>
            <p className="text-xs text-muted-foreground">
              {zoneName ?? "Sin zona"} · {PAYMENT_METHOD_LABELS[order.payment_method]}
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="text-sm font-semibold text-foreground">{formatCurrencyCents(order.total_cents)}</span>
          <Badge variant="outline" className="text-[10px]">
            {DELIVERY_STATUS_LABELS[order.delivery_status]}
          </Badge>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <AssignDriverSelect orderId={order.id} driverId={order.delivery_driver_id} drivers={drivers} />
        <Button variant="outline" size="sm" asChild>
          <Link href={`/pedidos/${order.id}`}>Ver pedido</Link>
        </Button>
      </div>
    </div>
  );
}

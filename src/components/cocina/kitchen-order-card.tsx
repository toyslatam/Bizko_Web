"use client";

import * as React from "react";
import { AlertTriangle, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { setOrderStatusAction } from "@/app/(app)/pedidos/actions";
import { DELIVERY_TYPE_LABELS } from "@/lib/orders";
import { cn } from "@/lib/utils";
import type { KitchenOrder } from "@/app/(app)/cocina/page";

const DELAYED_THRESHOLD_MINUTES = 15;
const TICK_INTERVAL_MS = 30_000;

function elapsedMinutes(createdAt: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 60_000));
}

function formatModifiers(modifiers: { name: string; price_cents: number }[]): string | null {
  if (!modifiers || modifiers.length === 0) return null;
  return modifiers.map((m) => m.name).join(", ");
}

export function KitchenOrderCard({ order, tableName }: { order: KitchenOrder; tableName?: string }) {
  const [, forceTick] = React.useReducer((n: number) => n + 1, 0);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    const interval = setInterval(forceTick, TICK_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  const minutes = elapsedMinutes(order.created_at);
  const isDelayed = minutes > DELAYED_THRESHOLD_MINUTES;

  async function advance(status: "preparing" | "ready") {
    setLoading(true);
    await setOrderStatusAction(order.id, status, false);
    setLoading(false);
  }

  return (
    <div
      className={cn(
        "rounded-xl border bg-card p-4 shadow-sm",
        isDelayed ? "border-destructive/60 bg-destructive/5" : "border-border",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-lg font-bold text-foreground">#{order.order_number}</p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <Badge variant="secondary">{DELIVERY_TYPE_LABELS[order.fulfillment]}</Badge>
            {order.table_id && <Badge variant="outline">{tableName ?? "Mesa"}</Badge>}
          </div>
        </div>
        <div
          className={cn(
            "flex items-center gap-1 text-sm text-muted-foreground",
            isDelayed && "text-base font-bold text-destructive",
          )}
        >
          {isDelayed ? <AlertTriangle className="size-4" /> : <Clock className="size-4" />}
          Hace {minutes} min
        </div>
      </div>

      <ul className="mt-3 space-y-2 border-t border-border pt-3">
        {order.order_items.map((item) => {
          const modifiersText = formatModifiers(item.modifiers);
          return (
            <li key={item.id} className="text-base">
              <p className="font-semibold text-foreground">
                {item.quantity}× {item.product_name}
              </p>
              {modifiersText && <p className="text-sm text-muted-foreground">{modifiersText}</p>}
              {item.notes && (
                <p className="mt-1 rounded-md border border-amber-500/50 bg-amber-500/10 px-2 py-1 text-sm font-medium text-amber-700 dark:text-amber-400">
                  {item.notes}
                </p>
              )}
            </li>
          );
        })}
      </ul>

      {order.notes && (
        <p className="mt-3 rounded-md border border-amber-500/50 bg-amber-500/10 px-2 py-1 text-sm font-medium text-amber-700 dark:text-amber-400">
          {order.notes}
        </p>
      )}

      <div className="mt-4">
        {(order.status === "pending" || order.status === "confirmed") && (
          <Button className="w-full" disabled={loading} onClick={() => advance("preparing")}>
            Empezar a preparar
          </Button>
        )}
        {order.status === "preparing" && (
          <Button className="w-full" disabled={loading} onClick={() => advance("ready")}>
            Marcar listo
          </Button>
        )}
        {order.status === "ready" && (
          <p className="text-center text-sm font-medium text-muted-foreground">Listo — esperando entrega</p>
        )}
      </div>
    </div>
  );
}

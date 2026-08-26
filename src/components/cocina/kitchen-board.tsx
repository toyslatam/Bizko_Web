"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { KitchenOrderCard } from "@/components/cocina/kitchen-order-card";
import type { KitchenOrder } from "@/app/(app)/cocina/page";

const REFRESH_INTERVAL_MS = 25_000;

interface KitchenBoardProps {
  orders: KitchenOrder[];
  tableNames: Record<string, string>;
}

interface Column {
  key: string;
  title: string;
  orders: KitchenOrder[];
}

export function KitchenBoard({ orders, tableNames }: KitchenBoardProps) {
  const router = useRouter();

  React.useEffect(() => {
    const interval = setInterval(() => {
      router.refresh();
    }, REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [router]);

  const columns: Column[] = [
    {
      key: "nuevos",
      title: "Nuevos",
      orders: orders.filter((o) => o.status === "pending" || o.status === "confirmed"),
    },
    {
      key: "preparando",
      title: "Preparando",
      orders: orders.filter((o) => o.status === "preparing"),
    },
    {
      key: "listos",
      title: "Listos",
      orders: orders.filter((o) => o.status === "ready"),
    },
  ];

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button variant="outline" size="sm" onClick={() => router.refresh()}>
          <RefreshCw /> Actualizar
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {columns.map((column) => (
          <div key={column.key} className="flex flex-col gap-3">
            <h2 className="font-heading text-lg font-semibold tracking-tight text-foreground">
              {column.title}{" "}
              <span className="text-sm font-normal text-muted-foreground">({column.orders.length})</span>
            </h2>

            <div className="flex flex-col gap-3">
              {column.orders.length === 0 ? (
                <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                  Sin pedidos
                </p>
              ) : (
                column.orders.map((order) => (
                  <KitchenOrderCard key={order.id} order={order} tableName={order.table_id ? tableNames[order.table_id] : undefined} />
                ))
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

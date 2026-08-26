import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/lib/auth/session";
import { Badge } from "@/components/ui/badge";
import { WorkOrderStatusPanel } from "@/components/ordenes-trabajo/work-order-status-panel";
import { WORK_ORDER_STATUS_LABELS, customerFullName } from "@/lib/catalog";
import { formatCurrencyCents } from "@/lib/format";
import type { Customer, Vehicle, WorkOrder } from "@/types/database";

export default async function WorkOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSessionContext();
  if (!session) redirect("/login");
  if (!session.activeCompany) redirect("/onboarding");

  const { id } = await params;
  const supabase = await createClient();

  const { data } = await supabase
    .from("work_orders")
    .select("*, customers(*), vehicles(*)")
    .eq("id", id)
    .maybeSingle();

  const order = data as
    | (WorkOrder & { customers: Customer | null; vehicles: Vehicle | null })
    | null;
  if (!order) notFound();

  return (
    <div className="max-w-2xl">
      <Link
        href="/ordenes-trabajo"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Órdenes de trabajo
      </Link>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-heading text-xl font-semibold text-foreground">
              {order.order_number}
            </h1>
            <Badge variant="outline">{WORK_ORDER_STATUS_LABELS[order.status]}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {new Date(order.created_at).toLocaleString("es-CO", {
              dateStyle: "long",
              timeStyle: "short",
            })}
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 rounded-xl border border-border bg-card p-4 sm:grid-cols-2">
        <div>
          <p className="text-xs text-muted-foreground">Cliente</p>
          <p className="text-sm text-foreground">
            {order.customers ? customerFullName(order.customers) : "—"}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Vehículo</p>
          <p className="text-sm text-foreground">
            {order.vehicles
              ? `${order.vehicles.plate}${
                  [order.vehicles.brand, order.vehicles.model].filter(Boolean).length
                    ? ` · ${[order.vehicles.brand, order.vehicles.model].filter(Boolean).join(" ")}`
                    : ""
                }`
              : "—"}
          </p>
        </div>
        <div className="sm:col-span-2">
          <p className="text-xs text-muted-foreground">Descripción</p>
          <p className="text-sm text-foreground">{order.description || "—"}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Total estimado</p>
          <p className="text-sm text-foreground">
            {order.estimated_total_cents != null
              ? formatCurrencyCents(order.estimated_total_cents)
              : "—"}
          </p>
        </div>
        {order.final_total_cents != null && (
          <div>
            <p className="text-xs text-muted-foreground">Total final</p>
            <p className="text-sm font-medium text-foreground">
              {formatCurrencyCents(order.final_total_cents)}
            </p>
          </div>
        )}
        {order.diagnosis && (
          <div className="sm:col-span-2">
            <p className="text-xs text-muted-foreground">Diagnóstico</p>
            <p className="text-sm text-foreground">{order.diagnosis}</p>
          </div>
        )}
      </div>

      <div className="mt-4">
        <WorkOrderStatusPanel order={order} />
      </div>
    </div>
  );
}

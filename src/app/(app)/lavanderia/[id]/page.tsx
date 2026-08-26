import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Shirt } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/lib/auth/session";
import { LaundryOrderStatusSelect } from "@/components/lavanderia/laundry-order-status-select";
import { customerFullName } from "@/lib/catalog";
import type { Customer, LaundryOrder, LaundryOrderItem, Service } from "@/types/database";

interface LaundryOrderWithCustomer extends LaundryOrder {
  customer: Customer | null;
}

interface LaundryOrderItemWithService extends LaundryOrderItem {
  service: Service | null;
}

function formatDateTime(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("es-CO", {
    dateStyle: "long",
    timeStyle: "short",
  });
}

export default async function LaundryOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSessionContext();
  if (!session) redirect("/login");
  if (!session.activeCompany) redirect("/onboarding");

  const { id } = await params;
  const supabase = await createClient();

  const [{ data: orderData }, { data: itemsData }] = await Promise.all([
    supabase
      .from("laundry_orders")
      .select("*, customer:customers(*)")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("laundry_order_items")
      .select("*, service:services(*)")
      .eq("laundry_order_id", id)
      .order("id"),
  ]);

  const order = orderData as unknown as LaundryOrderWithCustomer | null;
  if (!order) notFound();
  const items = (itemsData ?? []) as unknown as LaundryOrderItemWithService[];

  return (
    <div className="max-w-2xl">
      <Link
        href="/lavanderia"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Lavandería
      </Link>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand/15 text-brand">
            <Shirt className="size-5" />
          </span>
          <div>
            <h1 className="font-heading text-xl font-semibold text-foreground">
              {order.order_number}
            </h1>
            <p className="text-sm text-muted-foreground">
              Recibido {formatDateTime(order.received_at)}
            </p>
          </div>
        </div>
        <LaundryOrderStatusSelect order={order} />
      </div>

      <div className="mt-6 grid gap-3 rounded-xl border border-border bg-card p-4 sm:grid-cols-2">
        <div>
          <p className="text-xs text-muted-foreground">Cliente</p>
          <p className="text-sm text-foreground">
            {order.customer ? customerFullName(order.customer) : "Cliente general"}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Entrega estimada</p>
          <p className="text-sm text-foreground">{formatDateTime(order.estimated_ready_at)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Entregado</p>
          <p className="text-sm text-foreground">{formatDateTime(order.delivered_at)}</p>
        </div>
      </div>

      <div className="mt-4 divide-y divide-border rounded-xl border border-border bg-card">
        {items.map((item) => (
          <div key={item.id} className="flex items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">{item.description}</p>
              {item.service && (
                <p className="text-xs text-muted-foreground">{item.service.name}</p>
              )}
            </div>
            <span className="text-sm text-muted-foreground">x{item.quantity}</span>
          </div>
        ))}
      </div>

      {order.notes && (
        <div className="mt-4 rounded-xl border border-border bg-muted/40 p-4 text-sm text-foreground">
          <p className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Notas
          </p>
          {order.notes}
        </div>
      )}
    </div>
  );
}

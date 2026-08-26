import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Home, Store, Phone, Bike, Clock } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/lib/auth/session";
import { Badge } from "@/components/ui/badge";
import { OrderStatusActions } from "@/components/pedidos/order-status-actions";
import { MarkPaidButton } from "@/components/pedidos/mark-paid-button";
import { AssignDriverSelect } from "@/components/delivery/assign-driver-select";
import { DeliveryStatusActions } from "@/components/delivery/delivery-status-actions";
import { ORDER_STATUS_LABELS, DELIVERY_TYPE_LABELS, PAYMENT_STATUS_LABELS } from "@/lib/orders";
import { DELIVERY_STATUS_LABELS } from "@/lib/delivery";
import { PAYMENT_METHOD_LABELS } from "@/lib/sales";
import { UNIT_SHORT_LABELS } from "@/lib/catalog";
import { formatCurrencyCents } from "@/lib/format";
import { can } from "@/lib/permissions";
import type { DeliveryDriver, DeliveryZone, Order, OrderItem, OrderStatus } from "@/types/database";

const STATUS_VARIANT: Record<OrderStatus, "default" | "secondary" | "outline" | "destructive"> = {
  pending: "secondary",
  confirmed: "default",
  preparing: "default",
  ready: "default",
  out_for_delivery: "default",
  delivered: "outline",
  canceled: "destructive",
};

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSessionContext();
  if (!session) redirect("/login");
  if (!session.activeCompany) redirect("/onboarding");

  const { id } = await params;
  const supabase = await createClient();
  const companyId = session.activeCompany.id;

  const [{ data: orderData }, { data: itemsData }] = await Promise.all([
    supabase.from("orders").select("*").eq("id", id).maybeSingle(),
    supabase.from("order_items").select("*").eq("order_id", id).order("id"),
  ]);

  const order = orderData as Order | null;
  if (!order) notFound();
  const items = (itemsData as OrderItem[]) ?? [];
  const isDelivery = order.fulfillment === "delivery";

  const [{ data: zoneData }, { data: driversData }, { data: saleData }] = await Promise.all([
    order.delivery_zone_id
      ? supabase.from("delivery_zones").select("*").eq("id", order.delivery_zone_id).maybeSingle()
      : Promise.resolve({ data: null }),
    isDelivery
      ? supabase.from("delivery_drivers").select("*").eq("company_id", companyId).order("name")
      : Promise.resolve({ data: [] }),
    supabase.from("sales").select("id, sale_number").eq("order_id", id).maybeSingle(),
  ]);

  const zone = zoneData as DeliveryZone | null;
  const drivers = (driversData as DeliveryDriver[]) ?? [];
  const linkedSale = saleData as { id: string; sale_number: string } | null;
  const canManageDelivery = can(session.activeMembership?.role ?? "employee", "delivery.gestionar");
  const showPayDialogForPickup = !isDelivery && order.status === "delivered" && order.payment_status === "pending";

  return (
    <div className="max-w-2xl">
      <Link
        href="/pedidos"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Pedidos
      </Link>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-heading text-xl font-semibold text-foreground"># {order.order_number}</h1>
            <Badge variant={STATUS_VARIANT[order.status]}>{ORDER_STATUS_LABELS[order.status]}</Badge>
            {isDelivery && (
              <Badge variant="outline">{DELIVERY_STATUS_LABELS[order.delivery_status]}</Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {new Date(order.created_at).toLocaleString("es-CO", { dateStyle: "long", timeStyle: "short" })}
          </p>
          {linkedSale && (
            <Link href={`/ventas/${linkedSale.id}`} className="text-sm font-medium text-brand hover:underline">
              Ver venta generada · # {linkedSale.sale_number}
            </Link>
          )}
        </div>
        <OrderStatusActions order={order} />
      </div>

      {showPayDialogForPickup && (
        <div className="mt-3">
          <MarkPaidButton order={order} />
        </div>
      )}

      <div className="mt-4 grid gap-3 rounded-xl border border-border bg-card p-4 sm:grid-cols-2">
        <div>
          <p className="text-xs text-muted-foreground">Cliente</p>
          <p className="text-sm text-foreground">{order.customer_name}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Teléfono</p>
          <p className="flex items-center gap-1.5 text-sm text-foreground">
            <Phone className="size-3.5 text-muted-foreground" /> {order.customer_phone}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Entrega</p>
          <p className="flex items-center gap-1.5 text-sm text-foreground">
            {isDelivery ? <Home className="size-3.5" /> : <Store className="size-3.5" />}
            {DELIVERY_TYPE_LABELS[order.fulfillment]}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Pago</p>
          <p className="text-sm text-foreground">
            {PAYMENT_METHOD_LABELS[order.payment_method]} · {PAYMENT_STATUS_LABELS[order.payment_status]}
          </p>
        </div>
        {order.delivery_address && (
          <div className="sm:col-span-2">
            <p className="text-xs text-muted-foreground">Dirección</p>
            <p className="text-sm text-foreground">
              {order.delivery_address}
              {order.delivery_neighborhood ? `, ${order.delivery_neighborhood}` : ""}
              {order.delivery_city ? `, ${order.delivery_city}` : ""}
            </p>
            {order.delivery_reference && (
              <p className="text-xs text-muted-foreground">{order.delivery_reference}</p>
            )}
          </div>
        )}
        {order.recipient_name && (order.recipient_name !== order.customer_name || order.recipient_phone !== order.customer_phone) && (
          <div className="sm:col-span-2">
            <p className="text-xs text-muted-foreground">Recibe</p>
            <p className="text-sm text-foreground">
              {order.recipient_name} · {order.recipient_phone}
            </p>
          </div>
        )}
      </div>

      {isDelivery && (
        <div className="mt-4 space-y-3 rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground">Entrega</p>
            {zone && <span className="text-xs text-muted-foreground">{zone.name}</span>}
          </div>

          {order.estimated_delivery_time && (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="size-3.5" /> Tiempo estimado: {order.estimated_delivery_time}
            </p>
          )}

          {order.delivery_failure_reason && (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
              Falló: {order.delivery_failure_reason}
            </p>
          )}

          {canManageDelivery && (
            <>
              <div className="flex items-center gap-2">
                <Bike className="size-4 shrink-0 text-muted-foreground" />
                <AssignDriverSelect orderId={order.id} driverId={order.delivery_driver_id} drivers={drivers} />
              </div>
              <DeliveryStatusActions order={order} />
            </>
          )}
        </div>
      )}

      <div className="mt-4 divide-y divide-border rounded-xl border border-border bg-card">
        {items.map((item) => (
          <div key={item.id} className="flex items-start justify-between gap-3 px-4 py-3 text-sm">
            <div>
              <p className="text-foreground">
                {item.quantity} {item.unit ? UNIT_SHORT_LABELS[item.unit] : ""} {item.product_name}
              </p>
              {item.modifiers.length > 0 && (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {item.modifiers.map((m) => m.name).join(", ")}
                </p>
              )}
              {item.notes && (
                <p className="mt-0.5 text-xs text-warning-foreground">{item.notes}</p>
              )}
            </div>
            <span className="shrink-0 font-medium text-foreground">{formatCurrencyCents(item.total_cents)}</span>
          </div>
        ))}
      </div>

      <div className="mt-4 space-y-1.5 rounded-xl border border-border bg-card p-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Subtotal</span>
          <span className="text-foreground">{formatCurrencyCents(order.subtotal_cents)}</span>
        </div>
        {order.delivery_fee_cents > 0 && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Entrega</span>
            <span className="text-foreground">{formatCurrencyCents(order.delivery_fee_cents)}</span>
          </div>
        )}
        <div className="flex items-center justify-between border-t border-border pt-1.5 font-heading text-base font-semibold text-foreground">
          <span>Total</span>
          <span>{formatCurrencyCents(order.total_cents)}</span>
        </div>
      </div>

      {order.notes && (
        <div className="mt-4 rounded-xl border border-border bg-muted/40 p-4 text-sm text-foreground">
          <p className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Notas</p>
          {order.notes}
        </div>
      )}
    </div>
  );
}

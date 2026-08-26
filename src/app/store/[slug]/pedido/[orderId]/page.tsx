import { notFound } from "next/navigation";
import Link from "next/link";
import { headers } from "next/headers";
import { CheckCircle2, Clock, Home, Store } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { ShareButton } from "@/components/store/share-button";
import { ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS } from "@/lib/orders";
import { DELIVERY_STATUS_LABELS } from "@/lib/delivery";
import { UNIT_SHORT_LABELS } from "@/lib/catalog";
import { formatCurrencyCents } from "@/lib/format";
import type { PublicOrder, PublicOrderItem } from "@/types/database";

export default async function OrderConfirmationPage({
  params,
}: {
  params: Promise<{ slug: string; orderId: string }>;
}) {
  const { slug, orderId } = await params;
  const supabase = await createClient();
  const headerList = await headers();
  const host = headerList.get("host") ?? "";
  const protocol = headerList.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");

  const [{ data: orderData }, { data: itemsData }] = await Promise.all([
    supabase.rpc("get_public_order", { p_order_id: orderId }).maybeSingle(),
    supabase.rpc("list_public_order_items", { p_order_id: orderId }),
  ]);

  const order = orderData as PublicOrder | null;
  if (!order || order.company_slug !== slug) notFound();
  const items = (itemsData as PublicOrderItem[]) ?? [];

  return (
    <div>
      <div className="flex flex-col items-center gap-2 rounded-xl border border-success/30 bg-success/10 px-6 py-8 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-success/20 text-success">
          <CheckCircle2 className="size-6" />
        </span>
        <p className="font-heading text-lg font-semibold text-foreground">¡Pedido enviado!</p>
        <p className="text-sm text-muted-foreground"># {order.order_number}</p>
        <p className="text-sm text-muted-foreground">{order.company_name} recibió tu pedido.</p>
        <ShareButton
          title={`Pedido ${order.order_number} · ${order.company_name}`}
          url={`${protocol}://${host}/store/${slug}/pedido/${order.id}`}
        />
      </div>

      <div className="mt-4 space-y-3 rounded-xl border border-border bg-card p-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Estado</span>
          <span className="font-medium text-foreground">
            {order.fulfillment === "delivery" ? DELIVERY_STATUS_LABELS[order.delivery_status] : ORDER_STATUS_LABELS[order.status]}
          </span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Entrega</span>
          <span className="flex items-center gap-1.5 font-medium text-foreground">
            {order.fulfillment === "delivery" ? <Home className="size-3.5" /> : <Store className="size-3.5" />}
            {order.fulfillment === "delivery" ? "A domicilio" : "Recoger en el negocio"}
          </span>
        </div>
        {order.delivery_address && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Dirección</span>
            <span className="text-right font-medium text-foreground">
              {order.delivery_address}
              {order.delivery_neighborhood ? `, ${order.delivery_neighborhood}` : ""}
            </span>
          </div>
        )}
        {order.estimated_delivery_time && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Tiempo estimado</span>
            <span className="flex items-center gap-1.5 font-medium text-foreground">
              <Clock className="size-3.5" /> {order.estimated_delivery_time}
            </span>
          </div>
        )}
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Pago</span>
          <span className="font-medium text-foreground">Contra entrega · {PAYMENT_STATUS_LABELS[order.payment_status]}</span>
        </div>
      </div>

      <div className="mt-4 divide-y divide-border rounded-xl border border-border bg-card">
        {items.map((item) => (
          <div key={item.id} className="flex items-center justify-between px-4 py-3 text-sm">
            <span className="text-foreground">
              {item.quantity} {item.unit ? UNIT_SHORT_LABELS[item.unit] : ""} {item.product_name}
            </span>
            <span className="font-medium text-foreground">{formatCurrencyCents(item.total_cents)}</span>
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
        <div className="flex items-center justify-between border-t border-border pt-1.5 font-heading text-lg font-semibold text-foreground">
          <span>Total</span>
          <span>{formatCurrencyCents(order.total_cents)}</span>
        </div>
      </div>

      <Button asChild size="lg" className="mt-6 h-11 w-full">
        <Link href={`/store/${slug}`}>Seguir comprando</Link>
      </Button>
    </div>
  );
}

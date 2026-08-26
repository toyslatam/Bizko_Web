import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Package, Wrench } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/lib/auth/session";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { VoidSaleButton } from "@/components/ventas/void-sale-button";
import { customerFullName } from "@/lib/catalog";
import { PAYMENT_METHOD_LABELS, SALE_STATUS_LABELS, SALE_SOURCE_LABELS } from "@/lib/sales";
import { can } from "@/lib/permissions";
import { formatCurrencyCents } from "@/lib/format";
import type { Customer, Profile, Sale, SaleItem } from "@/types/database";

interface SaleWithRelations extends Sale {
  customer: Customer | null;
  user: Profile | null;
}

export default async function SaleDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  const session = await getSessionContext();
  if (!session) redirect("/login");
  if (!session.activeCompany) redirect("/onboarding");

  const { id } = await params;
  const { created } = await searchParams;
  const supabase = await createClient();

  const [{ data: saleData }, { data: itemsData }] = await Promise.all([
    supabase
      .from("sales")
      .select("*, customer:customers(*), user:profiles(*)")
      .eq("id", id)
      .maybeSingle(),
    supabase.from("sale_items").select("*").eq("sale_id", id).order("id"),
  ]);

  const sale = saleData as unknown as SaleWithRelations | null;
  if (!sale) notFound();
  const items = (itemsData ?? []) as SaleItem[];
  const canVoid = can(session.activeMembership?.role ?? "employee", "ventas.anular");

  return (
    <div className="max-w-2xl">
      <Link
        href="/ventas"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Ventas
      </Link>

      {created === "1" && (
        <div className="mb-6 flex flex-col items-center gap-2 rounded-xl border border-success/30 bg-success/10 px-6 py-6 text-center">
          <span className="flex size-10 items-center justify-center rounded-full bg-success/20 text-success">
            <CheckCircle2 className="size-5" />
          </span>
          <p className="font-heading text-lg font-semibold text-foreground">Venta completada</p>
          <p className="text-sm text-muted-foreground"># {sale.sale_number}</p>
          <p className="font-heading text-2xl font-semibold text-foreground">
            {formatCurrencyCents(sale.total_cents)}
          </p>
          <Button asChild className="mt-2">
            <Link href="/ventas/nuevo">Nueva venta</Link>
          </Button>
        </div>
      )}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-heading text-xl font-semibold text-foreground">
              # {sale.sale_number}
            </h1>
            <Badge variant={sale.status === "completed" ? "default" : "outline"}>
              {SALE_STATUS_LABELS[sale.status]}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {new Date(sale.created_at).toLocaleString("es-CO", {
              dateStyle: "long",
              timeStyle: "short",
            })}
          </p>
        </div>
        {canVoid && sale.status === "completed" && <VoidSaleButton saleId={sale.id} />}
      </div>

      <div className="mt-4 grid gap-3 rounded-xl border border-border bg-card p-4 sm:grid-cols-2">
        <div>
          <p className="text-xs text-muted-foreground">Cliente</p>
          <p className="text-sm text-foreground">
            {sale.customer ? customerFullName(sale.customer) : "Cliente general"}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Vendido por</p>
          <p className="text-sm text-foreground">
            {sale.user
              ? [sale.user.first_name, sale.user.last_name].filter(Boolean).join(" ") ||
                sale.user.email.split("@")[0]
              : "—"}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Método de pago</p>
          <p className="text-sm text-foreground">{PAYMENT_METHOD_LABELS[sale.payment_method]}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Origen</p>
          <p className="text-sm text-foreground">
            {SALE_SOURCE_LABELS[sale.source]}
            {sale.order_id && (
              <>
                {" · "}
                <Link href={`/pedidos/${sale.order_id}`} className="text-brand hover:underline">
                  Ver pedido de origen
                </Link>
              </>
            )}
          </p>
        </div>
      </div>

      <div className="mt-4 divide-y divide-border rounded-xl border border-border bg-card">
        {items.map((item) => (
          <div key={item.id} className="flex items-center gap-3 px-4 py-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              {item.item_type === "product" ? (
                <Package className="size-4" />
              ) : (
                <Wrench className="size-4" />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">{item.name}</p>
              <p className="text-xs text-muted-foreground">
                {item.quantity} × {formatCurrencyCents(item.unit_price_cents)}
                {item.discount_cents > 0 && ` · -${formatCurrencyCents(item.discount_cents)}`}
              </p>
            </div>
            <span className="text-sm font-medium text-foreground">
              {formatCurrencyCents(item.total_cents)}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-4 space-y-1.5 rounded-xl border border-border bg-card p-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Subtotal</span>
          <span className="text-foreground">{formatCurrencyCents(sale.subtotal_cents)}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Descuento</span>
          <span className="text-foreground">{formatCurrencyCents(sale.discount_cents)}</span>
        </div>
        {sale.tax_cents > 0 && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Impuestos</span>
            <span className="text-foreground">{formatCurrencyCents(sale.tax_cents)}</span>
          </div>
        )}
        <div className="flex items-center justify-between border-t border-border pt-1.5 font-heading text-base font-semibold text-foreground">
          <span>Total</span>
          <span>{formatCurrencyCents(sale.total_cents)}</span>
        </div>
      </div>

      {sale.notes && (
        <div className="mt-4 rounded-xl border border-border bg-muted/40 p-4 text-sm text-foreground">
          <p className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Notas
          </p>
          {sale.notes}
        </div>
      )}
    </div>
  );
}

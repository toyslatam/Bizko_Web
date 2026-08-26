import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/lib/auth/session";
import { TableStatusBadge } from "@/components/mesas/table-status-badge";
import { TableOrderBuilder } from "@/components/mesas/table-order-builder";
import { formatCurrencyCents } from "@/lib/format";
import { ORDER_STATUS_LABELS } from "@/lib/orders";
import type {
  ModifierGroup,
  ModifierOption,
  Order,
  OrderItem,
  Product,
  ProductCategory,
  RestaurantTable,
} from "@/types/database";

type ProductWithModifiers = Product & {
  modifier_groups: (ModifierGroup & { modifier_options: ModifierOption[] })[];
};

export default async function TableDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionContext();
  if (!session) redirect("/login");
  if (!session.activeCompany) redirect("/onboarding");

  const { id } = await params;
  const supabase = await createClient();
  const companyId = session.activeCompany.id;

  const { data: tableData } = await supabase
    .from("restaurant_tables")
    .select("*")
    .eq("id", id)
    .eq("company_id", companyId)
    .maybeSingle();

  const table = tableData as RestaurantTable | null;
  if (!table) notFound();

  const [{ data: orderData }, { data: productsData }, { data: categoriesData }] = await Promise.all([
    supabase
      .from("orders")
      .select("*, order_items(*)")
      .eq("table_id", id)
      .not("status", "in", "(delivered,canceled)")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("products")
      .select("*, modifier_groups(*, modifier_options(*))")
      .eq("company_id", companyId)
      .eq("status", "active")
      .eq("is_published", true)
      .eq("is_ingredient", false)
      .order("name"),
    supabase
      .from("product_categories")
      .select("*")
      .eq("company_id", companyId)
      .eq("status", "active")
      .order("sort_order"),
  ]);

  const openOrder = (orderData as (Order & { order_items: OrderItem[] }) | null) ?? null;
  const products = ((productsData as ProductWithModifiers[]) ?? []).map((p) => ({
    ...p,
    modifier_groups: p.modifier_groups ?? [],
  }));
  const categories = (categoriesData as ProductCategory[]) ?? [];

  return (
    <div className="max-w-3xl">
      <Link
        href="/mesas"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Mesas
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-heading text-xl font-semibold text-foreground">{table.name}</h1>
            <TableStatusBadge status={table.status} />
          </div>
          {table.capacity !== null && (
            <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
              <Users className="size-3.5" /> {table.capacity} personas
            </p>
          )}
        </div>
      </div>

      {openOrder ? (
        <div className="mt-4 space-y-3">
          <div className="rounded-xl border border-border bg-muted/40 p-4 text-sm text-foreground">
            Esta mesa ya tiene un pedido abierto (# {openOrder.order_number} ·{" "}
            {ORDER_STATUS_LABELS[openOrder.status]}). Ciérralo antes de tomar uno nuevo, o gestiónalo desde{" "}
            <Link href={`/pedidos/${openOrder.id}`} className="font-medium text-brand hover:underline">
              Pedidos
            </Link>
            .
          </div>

          <div className="divide-y divide-border rounded-xl border border-border bg-card">
            {openOrder.order_items.map((item) => (
              <div key={item.id} className="flex items-start justify-between gap-3 px-4 py-3 text-sm">
                <div>
                  <p className="text-foreground">
                    {item.quantity} × {item.product_name}
                  </p>
                  {item.modifiers.length > 0 && (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {item.modifiers.map((m) => m.name).join(", ")}
                    </p>
                  )}
                  {item.notes && <p className="mt-0.5 text-xs text-muted-foreground">{item.notes}</p>}
                </div>
                <span className="shrink-0 font-medium text-foreground">{formatCurrencyCents(item.total_cents)}</span>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between rounded-xl border border-border bg-card p-4 font-heading text-base font-semibold text-foreground">
            <span>Total</span>
            <span>{formatCurrencyCents(openOrder.total_cents)}</span>
          </div>
        </div>
      ) : (
        <div className="mt-4">
          <TableOrderBuilder tableId={table.id} products={products} categories={categories} />
        </div>
      )}
    </div>
  );
}

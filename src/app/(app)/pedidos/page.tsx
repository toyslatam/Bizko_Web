import { redirect } from "next/navigation";
import { ClipboardList } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/lib/auth/session";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { OrdersToolbar } from "@/components/pedidos/orders-toolbar";
import { OrderList } from "@/components/pedidos/order-list";
import { resolveDateRange } from "@/lib/dates";
import type { Order, OrderFulfillment, OrderStatus } from "@/types/database";

interface PageProps {
  searchParams: Promise<{ status?: string; fulfillment?: string; range?: string }>;
}

export default async function PedidosPage({ searchParams }: PageProps) {
  const session = await getSessionContext();
  if (!session) redirect("/login");
  if (!session.activeCompany) redirect("/onboarding");

  const { status, fulfillment, range } = await searchParams;
  const supabase = await createClient();
  const companyId = session.activeCompany.id;

  let query = supabase
    .from("orders")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  if (status) query = query.eq("status", status as OrderStatus);
  if (fulfillment) query = query.eq("fulfillment", fulfillment as OrderFulfillment);
  const dateRange = resolveDateRange(range);
  if (dateRange) query = query.gte("created_at", dateRange.from).lt("created_at", dateRange.to);

  const { data } = await query;
  const orders = (data as Order[]) ?? [];
  const hasFilters = Boolean(status) || Boolean(fulfillment) || Boolean(range);

  return (
    <div>
      <PageHeader title="Pedidos" description="Pedidos hechos desde tu catálogo público." />

      {orders.length > 0 || hasFilters ? (
        <div className="space-y-4">
          <OrdersToolbar />
          {orders.length > 0 ? (
            <OrderList orders={orders} />
          ) : (
            <EmptyState icon={ClipboardList} title="Sin resultados" description="No encontramos pedidos con esos filtros." />
          )}
        </div>
      ) : (
        <EmptyState
          icon={ClipboardList}
          title="Los pedidos aparecerán aquí"
          description="Comparte el enlace de tu catálogo público para empezar a recibir pedidos."
        />
      )}
    </div>
  );
}

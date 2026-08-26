import { redirect } from "next/navigation";
import { Shirt } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/lib/auth/session";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { ListToolbar } from "@/components/catalog/list-toolbar";
import { LaundryOrderFormSheet } from "@/components/lavanderia/laundry-order-form-sheet";
import { LaundryOrderList } from "@/components/lavanderia/laundry-order-list";
import { LAUNDRY_ORDER_STATUS_LABELS } from "@/lib/catalog";
import type { Customer, LaundryOrder, LaundryOrderStatus, Service } from "@/types/database";

interface LaundryOrderWithCustomer extends LaundryOrder {
  customer: Customer | null;
}

const STATUS_OPTIONS = (
  Object.entries(LAUNDRY_ORDER_STATUS_LABELS) as [LaundryOrderStatus, string][]
).map(([value, label]) => ({ value, label }));

interface PageProps {
  searchParams: Promise<{ q?: string; status?: string }>;
}

export default async function LavanderiaPage({ searchParams }: PageProps) {
  const session = await getSessionContext();
  if (!session) redirect("/login");
  if (!session.activeCompany) redirect("/onboarding");

  const { q, status } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("laundry_orders")
    .select("*, customer:customers(*)")
    .eq("company_id", session.activeCompany.id)
    .order("received_at", { ascending: false });

  if (status && status in LAUNDRY_ORDER_STATUS_LABELS) {
    query = query.eq("status", status as LaundryOrderStatus);
  }
  if (q) {
    query = query.ilike("order_number", `%${q}%`);
  }

  const [{ data }, { data: customersData }, { data: servicesData }] = await Promise.all([
    query,
    supabase
      .from("customers")
      .select("*")
      .eq("company_id", session.activeCompany.id)
      .eq("status", "active")
      .order("first_name"),
    supabase
      .from("services")
      .select("*")
      .eq("company_id", session.activeCompany.id)
      .eq("status", "active")
      .order("name"),
  ]);

  const orders = (data ?? []) as unknown as LaundryOrderWithCustomer[];
  const customers = (customersData ?? []) as Customer[];
  const services = (servicesData ?? []) as Service[];
  const hasAnyOrder = orders.length > 0 || Boolean(q) || Boolean(status);

  return (
    <div>
      <PageHeader
        title="Lavandería"
        description="Órdenes de lavado y su estado."
        actions={<LaundryOrderFormSheet customers={customers} services={services} />}
      />

      {hasAnyOrder ? (
        <div className="space-y-4">
          <ListToolbar
            searchPlaceholder="Buscar orden..."
            statusOptions={STATUS_OPTIONS}
            showStatusFilter
          />
          {orders.length > 0 ? (
            <LaundryOrderList orders={orders} />
          ) : (
            <EmptyState
              icon={Shirt}
              title="Sin resultados"
              description="No encontramos órdenes con esos filtros."
            />
          )}
        </div>
      ) : (
        <EmptyState
          icon={Shirt}
          title="Todavía no tienes órdenes de lavado"
          description="Cuando registres una orden, aparecerá aquí."
          action={<LaundryOrderFormSheet customers={customers} services={services} />}
        />
      )}
    </div>
  );
}

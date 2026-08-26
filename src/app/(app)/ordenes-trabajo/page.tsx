import { redirect } from "next/navigation";
import Link from "next/link";
import { Wrench } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/lib/auth/session";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { ListToolbar } from "@/components/catalog/list-toolbar";
import { WorkOrderFormSheet } from "@/components/ordenes-trabajo/work-order-form-sheet";
import { WorkOrderList } from "@/components/ordenes-trabajo/work-order-list";
import { WORK_ORDER_STATUS_LABELS } from "@/lib/catalog";
import type { Customer, Vehicle, WorkOrder, WorkOrderStatus } from "@/types/database";

const STATUS_OPTIONS = (
  Object.entries(WORK_ORDER_STATUS_LABELS) as [WorkOrderStatus, string][]
).map(([value, label]) => ({ value, label }));

interface PageProps {
  searchParams: Promise<{ q?: string; status?: string }>;
}

export default async function OrdenesTrabajoPage({ searchParams }: PageProps) {
  const session = await getSessionContext();
  if (!session) redirect("/login");
  if (!session.activeCompany) redirect("/onboarding");

  const { q, status } = await searchParams;
  const companyId = session.activeCompany.id;
  const supabase = await createClient();

  let query = supabase
    .from("work_orders")
    .select("*, customers(first_name,last_name), vehicles(plate,brand,model)")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  if (status && (Object.keys(WORK_ORDER_STATUS_LABELS) as string[]).includes(status)) {
    query = query.eq("status", status as WorkOrderStatus);
  }
  if (q) {
    query = query.ilike("order_number", `%${q}%`);
  }

  const [{ data }, { data: customersData }, { data: vehiclesData }] = await Promise.all([
    query,
    supabase
      .from("customers")
      .select("*")
      .eq("company_id", companyId)
      .eq("status", "active")
      .order("first_name"),
    supabase.from("vehicles").select("*").eq("company_id", companyId).order("plate"),
  ]);

  const orders = (data ?? []) as (WorkOrder & {
    customers: Pick<Customer, "first_name" | "last_name"> | null;
    vehicles: Pick<Vehicle, "plate" | "brand" | "model"> | null;
  })[];
  const customers = (customersData ?? []) as Customer[];
  const vehicles = (vehiclesData ?? []) as Vehicle[];
  const hasAnyOrder = orders.length > 0 || Boolean(q) || Boolean(status);

  return (
    <div>
      <PageHeader
        title="Órdenes de trabajo"
        description="Reparaciones y mantenimiento de vehículos."
        actions={<WorkOrderFormSheet customers={customers} vehicles={vehicles} />}
      />

      {hasAnyOrder ? (
        <div className="space-y-4">
          <ListToolbar searchPlaceholder="Buscar por número..." statusOptions={STATUS_OPTIONS} />
          {orders.length > 0 ? (
            <WorkOrderList orders={orders} />
          ) : (
            <EmptyState
              icon={Wrench}
              title="Sin resultados"
              description="No encontramos órdenes de trabajo con esos filtros."
            />
          )}
        </div>
      ) : (
        <EmptyState
          icon={Wrench}
          title="Todavía no tienes órdenes de trabajo"
          description={
            vehicles.length === 0
              ? "Necesitas registrar al menos un vehículo antes de crear una orden."
              : "Cuando registres el ingreso de un vehículo, aparecerá aquí."
          }
          action={
            vehicles.length === 0 ? (
              <Link
                href="/vehiculos"
                className="text-sm font-medium text-brand underline underline-offset-2"
              >
                Registrar un vehículo
              </Link>
            ) : (
              <WorkOrderFormSheet customers={customers} vehicles={vehicles} />
            )
          }
        />
      )}
    </div>
  );
}

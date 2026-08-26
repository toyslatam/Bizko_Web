import { redirect } from "next/navigation";
import { Bike } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/lib/auth/session";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { ListToolbar } from "@/components/catalog/list-toolbar";
import { VehicleFormSheet } from "@/components/vehiculos/vehicle-form-sheet";
import { VehicleList } from "@/components/vehiculos/vehicle-list";
import type { Customer, Vehicle } from "@/types/database";

interface PageProps {
  searchParams: Promise<{ q?: string }>;
}

export default async function VehiculosPage({ searchParams }: PageProps) {
  const session = await getSessionContext();
  if (!session) redirect("/login");
  if (!session.activeCompany) redirect("/onboarding");

  const { q } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("vehicles")
    .select("*, customers(first_name, last_name)")
    .eq("company_id", session.activeCompany.id)
    .order("created_at", { ascending: false });

  if (q) {
    query = query.or(`plate.ilike.%${q}%,brand.ilike.%${q}%,model.ilike.%${q}%`);
  }

  const [{ data }, { data: customersData }] = await Promise.all([
    query,
    supabase
      .from("customers")
      .select("*")
      .eq("company_id", session.activeCompany.id)
      .eq("status", "active")
      .order("first_name", { ascending: true }),
  ]);

  const vehicles = (data ?? []) as (Vehicle & {
    customers: Pick<Customer, "first_name" | "last_name"> | null;
  })[];
  const customers = (customersData ?? []) as Customer[];
  const hasAnyVehicle = vehicles.length > 0 || Boolean(q);

  return (
    <div>
      <PageHeader
        title="Vehículos"
        description="Consulta y administra los vehículos de tus clientes."
        actions={<VehicleFormSheet customers={customers} />}
      />

      {hasAnyVehicle ? (
        <div className="space-y-4">
          <ListToolbar
            searchPlaceholder="Buscar por placa, marca o modelo..."
            showStatusFilter={false}
          />
          {vehicles.length > 0 ? (
            <VehicleList vehicles={vehicles} />
          ) : (
            <EmptyState
              icon={Bike}
              title="Sin resultados"
              description="No encontramos vehículos con esos filtros."
            />
          )}
        </div>
      ) : (
        <EmptyState
          icon={Bike}
          title="Todavía no tienes vehículos"
          description="Cuando agregues un vehículo, aparecerá aquí."
          action={<VehicleFormSheet customers={customers} />}
        />
      )}
    </div>
  );
}

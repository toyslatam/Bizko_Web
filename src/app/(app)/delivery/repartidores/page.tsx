import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Bike } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/lib/auth/session";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { DriverFormDialog } from "@/components/delivery/driver-form-dialog";
import { DriverList } from "@/components/delivery/driver-list";
import type { DeliveryDriver } from "@/types/database";

export default async function DeliveryDriversPage() {
  const session = await getSessionContext();
  if (!session) redirect("/login");
  if (!session.activeCompany) redirect("/onboarding");

  const supabase = await createClient();
  const { data } = await supabase
    .from("delivery_drivers")
    .select("*")
    .eq("company_id", session.activeCompany.id)
    .order("name");

  const drivers = (data as DeliveryDriver[]) ?? [];

  return (
    <div>
      <Link
        href="/configuracion"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Configuración
      </Link>
      <PageHeader
        title="Repartidores"
        description="Tu equipo de entregas a domicilio."
        actions={drivers.length > 0 ? <DriverFormDialog /> : undefined}
      />

      {drivers.length === 0 ? (
        <EmptyState
          icon={Bike}
          title="Todavía no tienes repartidores"
          description="Agrega un repartidor para poder asignarle pedidos de entrega."
          action={<DriverFormDialog />}
        />
      ) : (
        <DriverList drivers={drivers} />
      )}
    </div>
  );
}

import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, MapPinned } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/lib/auth/session";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { ZoneFormDialog } from "@/components/delivery/zone-form-dialog";
import { ZoneCard } from "@/components/delivery/zone-card";
import type { DeliveryArea, DeliveryZone } from "@/types/database";

export default async function DeliveryZonesPage() {
  const session = await getSessionContext();
  if (!session) redirect("/login");
  if (!session.activeCompany) redirect("/onboarding");

  const supabase = await createClient();
  const companyId = session.activeCompany.id;

  const [{ data: zonesData }, { data: areasData }] = await Promise.all([
    supabase.from("delivery_zones").select("*").eq("company_id", companyId).order("name"),
    supabase.from("delivery_areas").select("*").eq("company_id", companyId).order("name"),
  ]);

  const zones = (zonesData as DeliveryZone[]) ?? [];
  const areas = (areasData as DeliveryArea[]) ?? [];

  return (
    <div>
      <Link
        href="/configuracion"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Configuración
      </Link>
      <PageHeader
        title="Zonas de entrega"
        description="Costo, pedido mínimo y tiempo estimado por zona."
        actions={zones.length > 0 ? <ZoneFormDialog /> : undefined}
      />

      {zones.length === 0 ? (
        <EmptyState
          icon={MapPinned}
          title="Todavía no tienes zonas de entrega"
          description="Crea una zona para calcular el costo de domicilio automáticamente."
          action={<ZoneFormDialog />}
        />
      ) : (
        <div className="space-y-3">
          {zones.map((zone) => (
            <ZoneCard key={zone.id} zone={zone} areas={areas.filter((a) => a.delivery_zone_id === zone.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

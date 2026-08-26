import { redirect } from "next/navigation";
import Link from "next/link";
import { Bike, MapPinned } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/lib/auth/session";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { DeliveryOrderCard } from "@/components/delivery/delivery-order-card";
import type { DeliveryDriver, DeliveryZone, Order } from "@/types/database";

const ACTIVE_STATUSES = ["pending_assignment", "assigned", "picked_up", "on_the_way"];

export default async function DeliveryOperationsPage() {
  const session = await getSessionContext();
  if (!session) redirect("/login");
  if (!session.activeCompany) redirect("/onboarding");

  const supabase = await createClient();
  const companyId = session.activeCompany.id;

  const [{ data: ordersData }, { data: zonesData }, { data: driversData }] = await Promise.all([
    supabase
      .from("orders")
      .select("*")
      .eq("company_id", companyId)
      .eq("fulfillment", "delivery")
      .in("delivery_status", ACTIVE_STATUSES)
      .order("created_at", { ascending: true }),
    supabase.from("delivery_zones").select("*").eq("company_id", companyId),
    supabase.from("delivery_drivers").select("*").eq("company_id", companyId).order("name"),
  ]);

  const orders = (ordersData as Order[]) ?? [];
  const zonesById = new Map(((zonesData as DeliveryZone[]) ?? []).map((z) => [z.id, z.name]));
  const drivers = (driversData as DeliveryDriver[]) ?? [];

  return (
    <div>
      <PageHeader
        title="Delivery"
        description="Pedidos por entregar, en orden de llegada."
        actions={
          <Button variant="ghost" size="sm" asChild>
            <Link href="/delivery/zonas">
              <MapPinned /> Zonas
            </Link>
          </Button>
        }
      />

      {orders.length === 0 ? (
        <EmptyState
          icon={Bike}
          title="No hay entregas pendientes"
          description="Los pedidos a domicilio por entregar aparecerán aquí."
        />
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <DeliveryOrderCard
              key={order.id}
              order={order}
              zoneName={order.delivery_zone_id ? (zonesById.get(order.delivery_zone_id) ?? null) : null}
              drivers={drivers}
            />
          ))}
        </div>
      )}
    </div>
  );
}

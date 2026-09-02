import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/lib/auth/session";
import { PageHeader } from "@/components/ui/page-header";
import { KitchenBoard } from "@/components/cocina/kitchen-board";
import type { Order, OrderItem, RestaurantTable } from "@/types/database";

export type KitchenOrder = Order & { order_items: OrderItem[] };

export default async function CocinaPage() {
  const session = await getSessionContext();
  if (!session) redirect("/login");
  if (!session.activeCompany) redirect("/onboarding");
  if (session.activeCompany.business_type !== "food") redirect("/dashboard");

  const supabase = await createClient();
  const companyId = session.activeCompany.id;

  const [{ data: orders }, { data: tables }] = await Promise.all([
    supabase
      .from("orders")
      .select("*, order_items(*)")
      .eq("company_id", companyId)
      .in("status", ["pending", "confirmed", "preparing", "ready"])
      .order("created_at", { ascending: true }),
    supabase.from("restaurant_tables").select("id, name").eq("company_id", companyId),
  ]);

  const tableNames = new Map<string, string>(
    ((tables as Pick<RestaurantTable, "id" | "name">[] | null) ?? []).map((t) => [t.id, t.name]),
  );

  return (
    <div>
      <PageHeader title="Cocina" description="Pedidos en preparación." />
      <KitchenBoard orders={(orders as KitchenOrder[]) ?? []} tableNames={Object.fromEntries(tableNames)} />
    </div>
  );
}

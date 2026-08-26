import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, History } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/lib/auth/session";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { MovementFilters } from "@/components/inventario/movement-filters";
import { MovementList, type MovementRow } from "@/components/inventario/movement-list";
import { resolveDateRange } from "@/lib/dates";
import type { InventoryMovementType, Product } from "@/types/database";

interface PageProps {
  searchParams: Promise<{ product?: string; type?: string; range?: string }>;
}

export default async function MovimientosPage({ searchParams }: PageProps) {
  const session = await getSessionContext();
  if (!session) redirect("/login");
  if (!session.activeCompany) redirect("/onboarding");

  const { product, type, range } = await searchParams;
  const supabase = await createClient();
  const companyId = session.activeCompany.id;

  const { data: products } = await supabase
    .from("products")
    .select("*")
    .eq("company_id", companyId)
    .eq("track_inventory", true)
    .order("name");

  let query = supabase
    .from("inventory_movements")
    .select("*, product:products(name,unit), user:profiles(first_name,last_name,email)")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .limit(200);

  if (product) query = query.eq("product_id", product);
  if (type) query = query.eq("movement_type", type as InventoryMovementType);
  const dateRange = resolveDateRange(range);
  if (dateRange) query = query.gte("created_at", dateRange.from).lt("created_at", dateRange.to);

  const { data } = await query;
  const movements = (data ?? []) as unknown as MovementRow[];
  const hasFilters = Boolean(product) || Boolean(type) || Boolean(range);

  return (
    <div>
      <Link
        href="/inventario"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Inventario
      </Link>
      <PageHeader
        title="Historial de movimientos"
        description="Entradas, salidas, ajustes y devoluciones de inventario."
      />

      {movements.length > 0 || hasFilters ? (
        <div className="space-y-4">
          <MovementFilters products={(products as Product[]) ?? []} />
          {movements.length > 0 ? (
            <MovementList movements={movements} />
          ) : (
            <EmptyState
              icon={History}
              title="Sin resultados"
              description="No encontramos movimientos con esos filtros."
            />
          )}
        </div>
      ) : (
        <EmptyState
          icon={History}
          title="Todavía no hay movimientos"
          description="Las entradas, salidas y ajustes de inventario aparecerán aquí."
        />
      )}
    </div>
  );
}

import { redirect } from "next/navigation";
import Link from "next/link";
import { Boxes, History } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/lib/auth/session";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { ListToolbar } from "@/components/catalog/list-toolbar";
import { InventoryList } from "@/components/inventario/inventory-list";
import { MovementDialog } from "@/components/inventario/movement-dialog";
import { can } from "@/lib/permissions";
import { stockStatus } from "@/lib/inventory";
import type { Product, ProductCategory } from "@/types/database";

interface PageProps {
  searchParams: Promise<{ q?: string; status?: string; category?: string }>;
}

export default async function InventarioPage({ searchParams }: PageProps) {
  const session = await getSessionContext();
  if (!session) redirect("/login");
  if (!session.activeCompany) redirect("/onboarding");

  const { q, status, category } = await searchParams;
  const supabase = await createClient();
  const companyId = session.activeCompany.id;

  const [{ data: categories }, { data: productsData }] = await Promise.all([
    supabase.from("product_categories").select("*").eq("company_id", companyId).order("name"),
    supabase
      .from("products")
      .select("*")
      .eq("company_id", companyId)
      .eq("track_inventory", true)
      .order("name"),
  ]);

  const categoriesById = new Map((categories as ProductCategory[] | null ?? []).map((c) => [c.id, c]));
  let products = (productsData as Product[] | null) ?? [];

  if (category) products = products.filter((p) => p.category_id === category);
  if (q) {
    const needle = q.toLowerCase();
    products = products.filter(
      (p) => p.name.toLowerCase().includes(needle) || (p.sku ?? "").toLowerCase().includes(needle),
    );
  }
  if (status === "low" || status === "out" || status === "available") {
    products = products.filter((p) => stockStatus(p) === status);
  }

  const canEdit = can(session.activeMembership?.role ?? "employee", "inventario.editar");
  const hasFilters = Boolean(q) || Boolean(status) || Boolean(category);
  const lowCount = products.filter((p) => stockStatus(p) === "low").length;
  const outCount = products.filter((p) => stockStatus(p) === "out").length;

  return (
    <div>
      <PageHeader
        title="Inventario"
        description="Existencias de tus productos con control de inventario activado."
        actions={
          canEdit ? (
            <div className="flex gap-2">
              <MovementDialog mode="in" products={products} />
              <MovementDialog mode="adjustment" products={products} />
              <Button variant="ghost" size="sm" asChild>
                <Link href="/inventario/movimientos">
                  <History /> Ver movimientos
                </Link>
              </Button>
            </div>
          ) : (
            <Button variant="ghost" size="sm" asChild>
              <Link href="/inventario/movimientos">
                <History /> Ver movimientos
              </Link>
            </Button>
          )
        }
      />

      {(lowCount > 0 || outCount > 0) && (
        <div className="mb-4 flex flex-wrap gap-2 text-sm">
          {outCount > 0 && (
            <span className="rounded-full bg-destructive/10 px-3 py-1 font-medium text-destructive">
              🔴 {outCount} agotado{outCount === 1 ? "" : "s"}
            </span>
          )}
          {lowCount > 0 && (
            <span className="rounded-full bg-warning/15 px-3 py-1 font-medium text-warning-foreground">
              ⚠️ {lowCount} con stock bajo
            </span>
          )}
        </div>
      )}

      {products.length > 0 || hasFilters ? (
        <div className="space-y-4">
          <ListToolbar
            searchPlaceholder="Buscar por nombre o SKU..."
            categories={[...categoriesById.values()].map((c) => ({ id: c.id, name: c.name }))}
            statusOptions={[
              { value: "available", label: "Disponible" },
              { value: "low", label: "Stock bajo" },
              { value: "out", label: "Agotado" },
            ]}
          />
          {products.length > 0 ? (
            <InventoryList products={products} categoriesById={categoriesById} />
          ) : (
            <EmptyState
              icon={Boxes}
              title="Sin resultados"
              description="No encontramos productos con esos filtros."
            />
          )}
        </div>
      ) : (
        <EmptyState
          icon={Boxes}
          title="Todavía no tienes productos con inventario"
          description='Activa "Controlar inventario" al crear o editar un producto para verlo aquí.'
          action={
            <Button asChild>
              <Link href="/productos">Ir a productos</Link>
            </Button>
          }
        />
      )}
    </div>
  );
}

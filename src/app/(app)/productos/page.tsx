import { redirect } from "next/navigation";
import { Package } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/lib/auth/session";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { ListToolbar } from "@/components/catalog/list-toolbar";
import { ProductFormSheet } from "@/components/productos/product-form-sheet";
import { ProductList } from "@/components/productos/product-list";
import type { EntityStatus, Product, ProductCategory, ProductVariant } from "@/types/database";

interface PageProps {
  searchParams: Promise<{ q?: string; status?: string; category?: string }>;
}

export default async function ProductosPage({ searchParams }: PageProps) {
  const session = await getSessionContext();
  if (!session) redirect("/login");
  if (!session.activeCompany) redirect("/onboarding");

  const { q, status, category } = await searchParams;
  const supabase = await createClient();
  const companyId = session.activeCompany.id;

  const { data: categories } = await supabase
    .from("product_categories")
    .select("*")
    .eq("company_id", companyId)
    .eq("status", "active")
    .order("name");

  let query = supabase
    .from("products")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  if (status === "active" || status === "inactive") {
    query = query.eq("status", status satisfies EntityStatus);
  }
  if (category) query = query.eq("category_id", category);
  if (q) query = query.or(`name.ilike.%${q}%,sku.ilike.%${q}%,description.ilike.%${q}%`);

  const { data } = await query;
  const products = (data ?? []) as Product[];
  const hasFilters = Boolean(q) || Boolean(status) || Boolean(category);

  // Los productos con variantes no tienen un price_cents propio (se maneja
  // por variante) — se calcula un rango real para no mostrar $0 en la lista.
  const variantProductIds = products.filter((p) => p.has_variants).map((p) => p.id);
  const priceRangeByProduct = new Map<string, { min: number; max: number }>();
  if (variantProductIds.length > 0) {
    const { data: variantsData } = await supabase
      .from("product_variants")
      .select("product_id, price_cents")
      .in("product_id", variantProductIds)
      .eq("status", "active");
    for (const v of (variantsData as Pick<ProductVariant, "product_id" | "price_cents">[]) ?? []) {
      const current = priceRangeByProduct.get(v.product_id);
      if (!current) {
        priceRangeByProduct.set(v.product_id, { min: v.price_cents, max: v.price_cents });
      } else {
        current.min = Math.min(current.min, v.price_cents);
        current.max = Math.max(current.max, v.price_cents);
      }
    }
  }

  return (
    <div>
      <PageHeader
        title="Productos"
        description="Administra el catálogo de productos de tu negocio."
        actions={
          <ProductFormSheet companyId={companyId} categories={(categories as ProductCategory[]) ?? []} />
        }
      />

      {products.length > 0 || hasFilters ? (
        <div className="space-y-4">
          <ListToolbar
            searchPlaceholder="Buscar producto..."
            categories={(categories as ProductCategory[])?.map((c) => ({ id: c.id, name: c.name }))}
          />
          {products.length > 0 ? (
            <ProductList products={products} priceRangeByProduct={priceRangeByProduct} />
          ) : (
            <EmptyState
              icon={Package}
              title="Sin resultados"
              description="No encontramos productos con esos filtros."
            />
          )}
        </div>
      ) : (
        <EmptyState
          icon={Package}
          title="Todavía no tienes productos"
          description="Agrega tu primer producto para empezar a construir tu catálogo."
          action={
            <ProductFormSheet companyId={companyId} categories={(categories as ProductCategory[]) ?? []} />
          }
        />
      )}
    </div>
  );
}

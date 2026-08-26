import { notFound } from "next/navigation";
import { PackageSearch, SearchX } from "lucide-react";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/ui/empty-state";
import { CategoryFilter } from "@/components/store/category-filter";
import { SortDropdown } from "@/components/store/sort-dropdown";
import { ProductCard } from "@/components/store/product-card";
import type { PublicCategory, PublicCompany, PublicProduct } from "@/types/database";

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ categoria?: string; buscar?: string; disponible?: string; orden?: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_public_company", { p_slug: slug }).maybeSingle();
  const company = data as PublicCompany | null;
  if (!company) return {};

  const description = company.description || `Compra en ${company.name}`;
  const image = company.banner_url ?? company.logo_url ?? "/files/app_icon.svg";

  return {
    title: company.name,
    description,
    openGraph: {
      title: company.name,
      description,
      images: [image],
    },
  };
}

export default async function PublicStorePage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const { categoria, buscar, disponible, orden } = await searchParams;
  const supabase = await createClient();

  const { data: companyData } = await supabase.rpc("get_public_company", { p_slug: slug }).maybeSingle();
  const company = companyData as PublicCompany | null;
  if (!company) notFound();

  const [{ data: categoriesData }, { data: productsData }] = await Promise.all([
    supabase.rpc("list_public_categories", { p_company_id: company.id }),
    supabase.rpc("list_public_products", {
      p_company_id: company.id,
      p_category_id: categoria || null,
      p_search: buscar || null,
    }),
  ]);

  const categories = (categoriesData as PublicCategory[]) ?? [];
  let products = (productsData as PublicProduct[]) ?? [];

  const onlyAvailable = disponible === "1";
  if (onlyAvailable) {
    products = products.filter((p) => !(p.track_inventory && p.current_stock <= 0));
  }
  if (orden === "precio_asc") {
    products = [...products].sort((a, b) => a.price_cents - b.price_cents);
  } else if (orden === "precio_desc") {
    products = [...products].sort((a, b) => b.price_cents - a.price_cents);
  }

  const isFiltering = Boolean(categoria || buscar || onlyAvailable);
  const featured = !isFiltering ? products.filter((p) => p.is_featured) : [];

  return (
    <div className="space-y-5">
      {categories.length > 0 && <CategoryFilter categories={categories} />}

      {featured.length > 0 && (
        <div className="space-y-2">
          <h2 className="font-heading text-sm font-semibold text-foreground">Destacados</h2>
          <div className="-mx-4 flex gap-3 overflow-x-auto px-4 [scrollbar-width:none] lg:mx-0 lg:px-0">
            {featured.map((p) => (
              <div key={p.id} className="w-40 shrink-0 sm:w-48">
                <ProductCard slug={slug} product={p} />
              </div>
            ))}
          </div>
        </div>
      )}

      {products.length === 0 ? (
        buscar ? (
          <EmptyState
            icon={SearchX}
            title={`No encontramos productos para «${buscar}»`}
            description="Prueba con otra palabra o revisa las categorías disponibles."
          />
        ) : onlyAvailable ? (
          <EmptyState
            icon={PackageSearch}
            title="No hay productos disponibles en este momento"
            description="Quita el filtro «Disponibles» para ver todo el catálogo."
          />
        ) : (
          <EmptyState
            icon={PackageSearch}
            title="Este negocio todavía no ha publicado productos"
            description="Vuelve pronto para ver su catálogo."
          />
        )
      ) : (
        <>
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-heading text-base font-semibold text-foreground">Nuestra colección</h2>
            <SortDropdown />
          </div>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 lg:gap-6 xl:grid-cols-4">
            {products.map((p) => (
              <ProductCard key={p.id} slug={slug} product={p} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

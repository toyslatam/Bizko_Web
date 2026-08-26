import { notFound } from "next/navigation";
import { PackageSearch, SearchX } from "lucide-react";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/ui/empty-state";
import { CategoryFilter } from "@/components/store/category-filter";
import { SearchBar } from "@/components/store/search-bar";
import { ProductCard } from "@/components/store/product-card";
import type { PublicCategory, PublicCompany, PublicProduct } from "@/types/database";

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ categoria?: string; buscar?: string }>;
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
  const { categoria, buscar } = await searchParams;
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
  const products = (productsData as PublicProduct[]) ?? [];
  const isFiltering = Boolean(categoria || buscar);
  const featured = !isFiltering ? products.filter((p) => p.is_featured) : [];

  return (
    <div className="space-y-4">
      <SearchBar />
      {categories.length > 0 && <CategoryFilter categories={categories} />}

      {featured.length > 0 && (
        <div className="space-y-2">
          <h2 className="font-heading text-sm font-semibold text-foreground">Destacados</h2>
          <div className="-mx-4 flex gap-3 overflow-x-auto px-4 [scrollbar-width:none]">
            {featured.map((p) => (
              <div key={p.id} className="w-40 shrink-0">
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
        ) : (
          <EmptyState
            icon={PackageSearch}
            title="Este negocio todavía no ha publicado productos"
            description="Vuelve pronto para ver su catálogo."
          />
        )
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {products.map((p) => (
            <ProductCard key={p.id} slug={slug} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}

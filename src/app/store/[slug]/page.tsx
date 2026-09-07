import { notFound } from "next/navigation";
import { PackageSearch, SearchX } from "lucide-react";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/ui/empty-state";
import { CategoryFilter } from "@/components/store/category-filter";
import { SortDropdown } from "@/components/store/sort-dropdown";
import { ProductCard } from "@/components/store/product-card";
import { ServiceCard } from "@/components/store/service-card";
import type { PublicCategory, PublicCompany, PublicProduct, PublicService } from "@/types/database";

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

  const isBarbershop = company.business_type === "barbershop";

  const [{ data: categoriesData }, { data: productsData }, { data: priceRangesData }, { data: servicesData }] =
    await Promise.all([
      supabase.rpc("list_public_categories", { p_company_id: company.id }),
      supabase.rpc("list_public_products", {
        p_company_id: company.id,
        p_category_id: categoria || null,
        p_search: buscar || null,
      }),
      supabase.rpc("list_public_variant_price_ranges", { p_company_id: company.id }),
      isBarbershop
        ? supabase.rpc("list_public_services", { p_company_id: company.id })
        : Promise.resolve({ data: [] as PublicService[] }),
    ]);

  const services = (servicesData as PublicService[]) ?? [];
  const categories = (categoriesData as PublicCategory[]) ?? [];
  let products = (productsData as PublicProduct[]) ?? [];
  const priceRangeByProduct = new Map<string, { min: number; max: number }>(
    ((priceRangesData as { product_id: string; min_price_cents: number; max_price_cents: number }[]) ?? []).map(
      (r) => [r.product_id, { min: r.min_price_cents, max: r.max_price_cents }],
    ),
  );

  function sortPrice(p: PublicProduct) {
    return p.has_variants ? (priceRangeByProduct.get(p.id)?.min ?? 0) : p.price_cents;
  }

  const onlyAvailable = disponible === "1";
  if (onlyAvailable) {
    products = products.filter((p) => !(p.track_inventory && p.current_stock <= 0));
  }
  if (orden === "precio_asc") {
    products = [...products].sort((a, b) => sortPrice(a) - sortPrice(b));
  } else if (orden === "precio_desc") {
    products = [...products].sort((a, b) => sortPrice(b) - sortPrice(a));
  }

  const isFiltering = Boolean(categoria || buscar || onlyAvailable);
  const featured = !isFiltering ? products.filter((p) => p.is_featured) : [];

  return (
    <div className="space-y-5">
      {isBarbershop && services.length > 0 && (
        <div className="space-y-2">
          <h2 className="font-heading text-base font-semibold text-foreground">Reservar una cita</h2>
          <p className="text-sm text-muted-foreground">Elige un servicio para agendar con uno de nuestros profesionales.</p>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 lg:gap-6 xl:grid-cols-4">
            {services.map((s) => (
              <ServiceCard key={s.id} slug={slug} service={s} />
            ))}
          </div>
        </div>
      )}

      {categories.length > 0 && <CategoryFilter categories={categories} />}

      {featured.length > 0 && (
        <div className="space-y-2">
          <h2 className="font-heading text-sm font-semibold text-foreground">Destacados</h2>
          <div className="-mx-4 flex gap-3 overflow-x-auto px-4 [scrollbar-width:none] lg:mx-0 lg:px-0">
            {featured.map((p) => (
              <div key={p.id} className="w-40 shrink-0 sm:w-48">
                <ProductCard slug={slug} product={p} priceRange={priceRangeByProduct.get(p.id)} />
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
              <ProductCard key={p.id} slug={slug} product={p} priceRange={priceRangeByProduct.get(p.id)} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

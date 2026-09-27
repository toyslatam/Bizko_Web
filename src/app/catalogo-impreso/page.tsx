import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/lib/auth/session";
import { PrintableCatalog, type CatalogEntry } from "@/components/productos/printable-catalog";
import { variantLabel } from "@/lib/variants";
import type {
  EntityStatus,
  Product,
  ProductCategory,
  ProductVariant,
  VariantAttribute,
} from "@/types/database";

interface PageProps {
  searchParams: Promise<{ q?: string; status?: string; category?: string }>;
}

/**
 * Catálogo completo para imprimir: cada producto con su foto, su precio, su
 * QR y el detalle de sus variantes.
 *
 * Vive fuera del grupo (app), como /etiquetas y /comprobante, para que al
 * papel no llegue la barra lateral. Acepta los mismos filtros que la lista de
 * productos, así se puede imprimir una sola categoría.
 */
export default async function CatalogoImpresoPage({ searchParams }: PageProps) {
  const session = await getSessionContext();
  if (!session) redirect("/login");
  if (!session.activeCompany) redirect("/onboarding");

  const { q, status, category } = await searchParams;
  const supabase = await createClient();
  const companyId = session.activeCompany.id;

  const { data: categoriesData } = await supabase
    .from("product_categories")
    .select("*")
    .eq("company_id", companyId)
    .order("name");

  let query = supabase
    .from("products")
    .select("*")
    .eq("company_id", companyId)
    .order("name");

  if (status === "active" || status === "inactive") {
    query = query.eq("status", status satisfies EntityStatus);
  }
  if (category) query = query.eq("category_id", category);
  if (q) query = query.or(`name.ilike.%${q}%,sku.ilike.%${q}%,description.ilike.%${q}%`);

  const { data: productsData } = await query;
  const products = (productsData as Product[] | null) ?? [];

  const categoryNameById = new Map(
    ((categoriesData as ProductCategory[] | null) ?? []).map((c) => [c.id, c.name]),
  );

  // Variantes y atributos de todos los productos en dos consultas, no una por
  // producto: un catálogo de 200 productos no puede hacer 400 viajes.
  const variantProductIds = products.filter((p) => p.has_variants).map((p) => p.id);
  const variantsByProduct = new Map<string, ProductVariant[]>();
  const variantLabels: Record<string, string> = {};

  if (variantProductIds.length > 0) {
    const { data: variantsData } = await supabase
      .from("product_variants")
      .select("*")
      .in("product_id", variantProductIds)
      .eq("status", "active")
      .order("created_at");

    const variants = (variantsData as ProductVariant[] | null) ?? [];
    for (const variant of variants) {
      const list = variantsByProduct.get(variant.product_id) ?? [];
      list.push(variant);
      variantsByProduct.set(variant.product_id, list);
    }

    if (variants.length > 0) {
      const { data: attrsData } = await supabase
        .from("variant_attributes")
        .select("*")
        .in(
          "variant_id",
          variants.map((v) => v.id),
        );

      const byVariant = new Map<string, VariantAttribute[]>();
      for (const attr of (attrsData as VariantAttribute[] | null) ?? []) {
        const list = byVariant.get(attr.variant_id) ?? [];
        list.push(attr);
        byVariant.set(attr.variant_id, list);
      }
      for (const variant of variants) {
        variantLabels[variant.id] = variantLabel(byVariant.get(variant.id) ?? []);
      }
    }
  }

  const entries: CatalogEntry[] = products.map((product) => ({
    product,
    categoryName: product.category_id
      ? (categoryNameById.get(product.category_id) ?? null)
      : null,
    variants: variantsByProduct.get(product.id) ?? [],
  }));

  return (
    <PrintableCatalog
      companyName={session.activeCompany.name}
      entries={entries}
      variantLabels={variantLabels}
    />
  );
}

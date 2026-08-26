import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/lib/auth/session";
import { PageHeader } from "@/components/ui/page-header";
import { SaleBuilder } from "@/components/ventas/sale-builder";
import { can } from "@/lib/permissions";
import type { Customer, Product, ProductVariant, Service, VariantAttribute } from "@/types/database";

export default async function NuevaVentaPage() {
  const session = await getSessionContext();
  if (!session) redirect("/login");
  if (!session.activeCompany) redirect("/onboarding");

  const supabase = await createClient();
  const companyId = session.activeCompany.id;

  const [{ data: products }, { data: services }, { data: customers }] = await Promise.all([
    supabase.from("products").select("*").eq("company_id", companyId).eq("status", "active").order("name"),
    supabase.from("services").select("*").eq("company_id", companyId).eq("status", "active").order("name"),
    supabase.from("customers").select("*").eq("company_id", companyId).eq("status", "active").order("first_name"),
  ]);

  const canEditPrice = can(session.activeMembership?.role ?? "employee", "ventas.editar_precio");

  const variantProductIds = ((products as Product[]) ?? []).filter((p) => p.has_variants).map((p) => p.id);
  let variants: ProductVariant[] = [];
  let variantAttributes: VariantAttribute[] = [];
  if (variantProductIds.length > 0) {
    const [{ data: variantsData }, { data: attributesData }] = await Promise.all([
      supabase
        .from("product_variants")
        .select("*")
        .eq("company_id", companyId)
        .eq("status", "active")
        .in("product_id", variantProductIds),
      supabase
        .from("variant_attributes")
        .select("*, product_variants!inner(company_id, product_id)")
        .in("product_variants.product_id", variantProductIds),
    ]);
    variants = (variantsData as ProductVariant[]) ?? [];
    variantAttributes = ((attributesData as unknown[]) ?? []).map((row) => {
      const { id, variant_id, attribute_name, attribute_value } = row as VariantAttribute;
      return { id, variant_id, attribute_name, attribute_value };
    });
  }

  return (
    <div>
      <PageHeader title="Nueva venta" description="Agrega productos o servicios y cobra rápido." />
      <SaleBuilder
        companyId={companyId}
        products={(products as Product[]) ?? []}
        services={(services as Service[]) ?? []}
        customers={(customers as Customer[]) ?? []}
        variants={variants}
        variantAttributes={variantAttributes}
        canEditPrice={canEditPrice}
      />
    </div>
  );
}

import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/lib/auth/session";
import { PrintableLabelSheet } from "@/components/productos/printable-label-sheet";
import { groupAttributesByVariant } from "@/lib/variants";
import type { Product, ProductVariant, VariantAttribute } from "@/types/database";

interface PageProps {
  params: Promise<{ id: string }>;
}

/**
 * Hoja de etiquetas para imprimir. Vive fuera del grupo (app) a propósito:
 * necesita la página desnuda, sin barra lateral ni encabezado, para que lo
 * único que llegue al papel sean las etiquetas.
 */
export default async function EtiquetasPage({ params }: PageProps) {
  const session = await getSessionContext();
  if (!session) redirect("/login");
  if (!session.activeCompany) redirect("/onboarding");

  const { id } = await params;
  const supabase = await createClient();
  const companyId = session.activeCompany.id;

  const { data: productData } = await supabase
    .from("products")
    .select("*")
    .eq("company_id", companyId)
    .eq("id", id)
    .maybeSingle();

  const product = productData as Product | null;
  if (!product) notFound();

  let variants: ProductVariant[] = [];
  let attributes: VariantAttribute[] = [];

  if (product.has_variants) {
    const [{ data: variantsData }, { data: attrsData }] = await Promise.all([
      supabase.from("product_variants").select("*").eq("product_id", id).order("created_at"),
      supabase
        .from("variant_attributes")
        .select("*, product_variants!inner(product_id)")
        .eq("product_variants.product_id", id),
    ]);
    variants = (variantsData as ProductVariant[]) ?? [];
    attributes = ((attrsData as unknown[]) ?? []).map((row) => {
      const { id: attrId, variant_id, attribute_name, attribute_value } = row as VariantAttribute;
      return { id: attrId, variant_id, attribute_name, attribute_value };
    });
  }

  return (
    <PrintableLabelSheet
      product={product}
      variants={variants}
      attributesByVariant={groupAttributesByVariant(attributes)}
    />
  );
}

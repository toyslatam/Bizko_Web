import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/lib/auth/session";
import { PrintableLabelSheet } from "@/components/productos/printable-label-sheet";
import type { Product, ProductVariant } from "@/types/database";

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

  // Solo hacen falta las variantes: la etiqueta es una sola por producto y
  // muestra el rango de precios, no el detalle de cada talla o color.
  let variants: ProductVariant[] = [];

  if (product.has_variants) {
    const { data: variantsData } = await supabase
      .from("product_variants")
      .select("*")
      .eq("product_id", id)
      .order("created_at");
    variants = (variantsData as ProductVariant[]) ?? [];
  }

  return (
    <PrintableLabelSheet product={product} variants={variants} />
  );
}

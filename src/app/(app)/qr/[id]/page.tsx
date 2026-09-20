import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/lib/auth/session";
import { PageHeader } from "@/components/ui/page-header";
import { QrSaleForm } from "@/components/ventas/qr-sale-form";
import { variantLabel, groupAttributesByVariant } from "@/lib/variants";
import type { QrVariantOption } from "@/lib/qr";
import { can } from "@/lib/permissions";
import type { Customer, Product, ProductVariant, VariantAttribute } from "@/types/database";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ v?: string }>;
}

/**
 * Destino del QR impreso en la etiqueta de un producto (ver
 * ProductQrLabels). Muestra el precio y registra la venta de una unidad.
 *
 * Es una ruta autenticada a propósito: confirmar acá crea una venta real y
 * descuenta inventario, así que no puede quedar abierta a cualquiera que
 * tenga el enlace. Para que un cliente consulte el precio sin registrar nada
 * está el catálogo público (/store/[slug]).
 */
export default async function QrProductPage({ params, searchParams }: PageProps) {
  const session = await getSessionContext();
  if (!session) redirect("/login");
  if (!session.activeCompany) redirect("/onboarding");

  const { id } = await params;
  const { v: variantId } = await searchParams;
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

  // Un producto tiene un único QR: si hay variantes, se eligen al confirmar.
  // `?v=` sigue aceptándose para las etiquetas impresas con el esquema viejo,
  // y llega como preselección.
  let variantOptions: QrVariantOption[] = [];

  if (product.has_variants) {
    const { data: variantsData } = await supabase
      .from("product_variants")
      .select("*")
      .eq("company_id", companyId)
      .eq("product_id", product.id)
      .eq("status", "active")
      .order("created_at");

    const variants = (variantsData as ProductVariant[] | null) ?? [];

    if (variants.length > 0) {
      const { data: attrs } = await supabase
        .from("variant_attributes")
        .select("*")
        .in("variant_id", variants.map((v) => v.id));
      const attributesByVariant = groupAttributesByVariant(
        (attrs as VariantAttribute[] | null) ?? [],
      );

      variantOptions = variants.map((v) => ({
        id: v.id,
        label: variantLabel(attributesByVariant.get(v.id) ?? []),
        priceCents: v.price_cents,
        stock: v.stock,
        imageUrl: v.image_url,
      }));
    }
  }

  const { data: customers } = await supabase
    .from("customers")
    .select("*")
    .eq("company_id", companyId)
    .eq("status", "active")
    .order("first_name");

  const role = session.activeMembership?.role ?? "employee";
  const canSell = can(role, "ventas.crear");
  const canEditPrice = can(role, "ventas.editar_precio");

  return (
    <div>
      <PageHeader title="Venta rápida" description="Escaneaste la etiqueta de este producto." />
      <QrSaleForm
        productId={product.id}
        name={product.name}
        imageUrl={product.image_url}
        basePriceCents={product.price_cents}
        variants={variantOptions}
        initialVariantId={variantId ?? null}
        customers={(customers as Customer[] | null) ?? []}
        canSell={canSell}
        canEditPrice={canEditPrice}
      />
    </div>
  );
}

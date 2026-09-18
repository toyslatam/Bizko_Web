import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/lib/auth/session";
import { PageHeader } from "@/components/ui/page-header";
import { QrSaleForm } from "@/components/ventas/qr-sale-form";
import { variantLabel } from "@/lib/variants";
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

  let variant: ProductVariant | null = null;
  let detail = "";

  if (variantId) {
    const { data: variantData } = await supabase
      .from("product_variants")
      .select("*")
      .eq("company_id", companyId)
      .eq("product_id", product.id)
      .eq("id", variantId)
      .maybeSingle();
    variant = variantData as ProductVariant | null;
    if (!variant) notFound();

    const { data: attrs } = await supabase
      .from("variant_attributes")
      .select("*")
      .eq("variant_id", variant.id);
    detail = variantLabel((attrs as VariantAttribute[] | null) ?? []);
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
        variantId={variant?.id ?? null}
        name={product.name}
        detail={detail}
        imageUrl={variant?.image_url ?? product.image_url}
        priceCents={variant ? variant.price_cents : product.price_cents}
        customers={(customers as Customer[] | null) ?? []}
        canSell={canSell}
        canEditPrice={canEditPrice}
      />
    </div>
  );
}

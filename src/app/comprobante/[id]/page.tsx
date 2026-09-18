import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/lib/auth/session";
import { SaleReceipt } from "@/components/ventas/sale-receipt";
import type { Customer, Sale, SaleItem } from "@/types/database";

interface PageProps {
  params: Promise<{ id: string }>;
}

/**
 * Comprobante imprimible de una venta. Igual que /etiquetas, vive fuera del
 * grupo (app) para que la página no traiga barra lateral ni encabezado: al
 * papel solo debe llegar el ticket.
 */
export default async function ComprobantePage({ params }: PageProps) {
  const session = await getSessionContext();
  if (!session) redirect("/login");
  if (!session.activeCompany) redirect("/onboarding");

  const { id } = await params;
  const supabase = await createClient();

  const [{ data: saleData }, { data: itemsData }] = await Promise.all([
    supabase
      .from("sales")
      .select("*, customer:customers(*)")
      .eq("id", id)
      .eq("company_id", session.activeCompany.id)
      .maybeSingle(),
    supabase.from("sale_items").select("*").eq("sale_id", id).order("id"),
  ]);

  const sale = saleData as unknown as (Sale & { customer: Customer | null }) | null;
  if (!sale) notFound();

  return (
    <SaleReceipt
      company={session.activeCompany}
      sale={sale}
      items={(itemsData as SaleItem[] | null) ?? []}
      customer={sale.customer}
    />
  );
}

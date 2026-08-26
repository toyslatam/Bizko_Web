import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CheckoutForm } from "@/components/store/checkout-form";
import type { PublicCompany, PublicDeliveryArea } from "@/types/database";

export default async function CheckoutPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: companyData } = await supabase.rpc("get_public_company", { p_slug: slug }).maybeSingle();
  const company = companyData as PublicCompany | null;
  if (!company) notFound();

  const { data: areasData } = company.delivery_enabled
    ? await supabase.rpc("list_public_delivery_areas", { p_company_id: company.id })
    : { data: [] };

  return (
    <CheckoutForm
      slug={slug}
      pickupEnabled={company.pickup_enabled}
      deliveryEnabled={company.delivery_enabled}
      areas={(areasData as PublicDeliveryArea[]) ?? []}
    />
  );
}

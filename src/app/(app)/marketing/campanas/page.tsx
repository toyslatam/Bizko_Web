import { redirect } from "next/navigation";
import Link from "next/link";
import { Megaphone } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { MarketingNav } from "@/components/marketing/marketing-nav";
import { CampaignFormDialog } from "@/components/marketing/campaign-form-dialog";
import { CampaignStatusBadge } from "@/components/marketing/campaign-status-badge";
import { getSessionContext } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { CAMPAIGN_AUDIENCE_LABELS, CAMPAIGN_OBJECTIVE_LABELS } from "@/lib/marketing";
import type { MarketingCampaign, MarketingSegment, Product, ProductCategory } from "@/types/database";

export default async function CampanasPage() {
  const session = await getSessionContext();
  if (!session) redirect("/login");
  if (!session.activeCompany) redirect("/onboarding");
  if (!session.enabledFeatures.has("marketing")) redirect("/dashboard");

  const supabase = await createClient();
  const companyId = session.activeCompany.id;
  const canManage = Boolean(
    session.activeMembership && can(session.activeMembership.role, "marketing.gestionar"),
  );

  const [{ data: campaignsData }, { data: segmentsData }, { data: categoriesData }, { data: productsData }] =
    await Promise.all([
      supabase
        .from("marketing_campaigns")
        .select("*")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false }),
      supabase.from("marketing_segments").select("*").eq("company_id", companyId).order("name"),
      supabase
        .from("product_categories")
        .select("*")
        .eq("company_id", companyId)
        .eq("status", "active")
        .order("name"),
      supabase
        .from("products")
        .select("*")
        .eq("company_id", companyId)
        .eq("status", "active")
        .order("name"),
    ]);

  const campaigns = (campaignsData ?? []) as MarketingCampaign[];
  const segments = (segmentsData ?? []) as MarketingSegment[];
  const categories = (categoriesData ?? []) as ProductCategory[];
  const products = (productsData ?? []) as Product[];

  return (
    <div>
      <PageHeader
        title="Campañas"
        description="Planea, aprueba y publica campañas de marketing."
        actions={canManage ? <CampaignFormDialog segments={segments} categories={categories} products={products} /> : undefined}
      />

      <MarketingNav />

      {campaigns.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title="Todavía no tienes campañas"
          description="Crea tu primera campaña para empezar a planear tu marketing."
        />
      ) : (
        <div className="space-y-2">
          {campaigns.map((campaign) => (
            <Link
              key={campaign.id}
              href={`/marketing/campanas/${campaign.id}`}
              className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4 transition-colors hover:border-brand/50 hover:bg-brand/5 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">{campaign.name}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {CAMPAIGN_OBJECTIVE_LABELS[campaign.objective]} ·{" "}
                  {CAMPAIGN_AUDIENCE_LABELS[campaign.audience_type]}
                </p>
              </div>
              <CampaignStatusBadge status={campaign.status} />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

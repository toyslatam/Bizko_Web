import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { CampaignStatusBadge } from "@/components/marketing/campaign-status-badge";
import { CampaignStatusFlow } from "@/components/marketing/campaign-status-flow";
import { CampaignContentForm } from "@/components/marketing/campaign-content-form";
import { CampaignContentList } from "@/components/marketing/campaign-content-list";
import { getSessionContext } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { CAMPAIGN_AUDIENCE_LABELS, CAMPAIGN_OBJECTIVE_LABELS } from "@/lib/marketing";
import { CHANNEL_TYPE_LABELS } from "@/lib/crm-channels";
import type { MarketingCampaign, MarketingCampaignContent } from "@/types/database";

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSessionContext();
  if (!session) redirect("/login");
  if (!session.activeCompany) redirect("/onboarding");
  if (!session.enabledFeatures.has("marketing")) redirect("/dashboard");

  const { id } = await params;
  const supabase = await createClient();

  const [{ data: campaignData }, { data: contentData }] = await Promise.all([
    supabase.from("marketing_campaigns").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("marketing_campaign_content")
      .select("*")
      .eq("campaign_id", id)
      .order("created_at", { ascending: false }),
  ]);

  const campaign = campaignData as MarketingCampaign | null;
  if (!campaign || campaign.company_id !== session.activeCompany.id) notFound();
  const content = (contentData ?? []) as MarketingCampaignContent[];
  const canManage = Boolean(
    session.activeMembership && can(session.activeMembership.role, "marketing.gestionar"),
  );

  return (
    <div className="max-w-2xl">
      <Link
        href="/marketing/campanas"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Campañas
      </Link>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="font-heading text-xl font-semibold text-foreground">{campaign.name}</h1>
        <CampaignStatusBadge status={campaign.status} />
      </div>

      <div className="mt-3 grid gap-3 rounded-xl border border-border bg-card p-4 sm:grid-cols-2">
        <Field label="Objetivo" value={CAMPAIGN_OBJECTIVE_LABELS[campaign.objective]} />
        <Field label="Audiencia" value={CAMPAIGN_AUDIENCE_LABELS[campaign.audience_type]} />
        <Field
          label="Canales"
          value={
            campaign.channels.length > 0
              ? campaign.channels.map((c) => CHANNEL_TYPE_LABELS[c]).join(", ")
              : "—"
          }
        />
        <Field
          label="Publicada"
          value={campaign.published_at ? new Date(campaign.published_at).toLocaleString("es-CO") : "—"}
        />
      </div>

      <div className="mt-6">
        <h2 className="mb-3 font-heading text-base font-semibold text-foreground">Estado</h2>
        <CampaignStatusFlow campaign={campaign} canManage={canManage} />
      </div>

      <div className="mt-6">
        <h2 className="mb-3 font-heading text-base font-semibold text-foreground">Contenido</h2>
        <div className="space-y-4">
          {canManage && <CampaignContentForm campaignId={campaign.id} />}
          {content.length === 0 ? (
            <EmptyState
              title="Sin contenido todavía"
              description="Agrega textos o creatividades para esta campaña."
            />
          ) : (
            <CampaignContentList content={content} />
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm text-foreground">{value}</p>
    </div>
  );
}

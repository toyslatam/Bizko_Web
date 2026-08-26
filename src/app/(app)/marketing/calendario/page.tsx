import { redirect } from "next/navigation";
import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { MarketingNav } from "@/components/marketing/marketing-nav";
import { CampaignStatusBadge } from "@/components/marketing/campaign-status-badge";
import { getSessionContext } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { CAMPAIGN_OBJECTIVE_LABELS } from "@/lib/marketing";
import type { MarketingCampaign } from "@/types/database";

const DATE_LABEL_FORMATTER = new Intl.DateTimeFormat("es-CO", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

function dateKey(iso: string): string {
  return iso.slice(0, 10);
}

export default async function CalendarioPage() {
  const session = await getSessionContext();
  if (!session) redirect("/login");
  if (!session.activeCompany) redirect("/onboarding");
  if (!session.enabledFeatures.has("marketing")) redirect("/dashboard");

  const supabase = await createClient();
  const companyId = session.activeCompany.id;

  const { data: campaignsData } = await supabase
    .from("marketing_campaigns")
    .select("*")
    .eq("company_id", companyId)
    .or("scheduled_at.not.is.null,published_at.not.is.null")
    .order("scheduled_at", { ascending: true, nullsFirst: false });

  const campaigns = (campaignsData ?? []) as MarketingCampaign[];

  const groups = new Map<string, { date: string; items: MarketingCampaign[] }>();
  for (const campaign of campaigns) {
    const iso = campaign.scheduled_at ?? campaign.published_at;
    if (!iso) continue;
    const key = dateKey(iso);
    if (!groups.has(key)) groups.set(key, { date: iso, items: [] });
    groups.get(key)!.items.push(campaign);
  }
  const orderedGroups = Array.from(groups.values()).sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );

  return (
    <div>
      <PageHeader title="Calendario" description="Campañas organizadas por su fecha de publicación." />

      <MarketingNav />

      {orderedGroups.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="Sin campañas programadas"
          description="Cuando programes o publiques una campaña, aparecerá aquí ordenada por fecha."
        />
      ) : (
        <div className="space-y-6">
          {orderedGroups.map((group) => (
            <div key={group.date}>
              <p className="mb-2 text-sm font-semibold text-foreground capitalize">
                {DATE_LABEL_FORMATTER.format(new Date(group.date))}
              </p>
              <div className="space-y-2">
                {group.items.map((campaign) => (
                  <Link
                    key={campaign.id}
                    href={`/marketing/campanas/${campaign.id}`}
                    className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4 transition-colors hover:border-brand/50 hover:bg-brand/5 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">{campaign.name}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {CAMPAIGN_OBJECTIVE_LABELS[campaign.objective]} ·{" "}
                        {new Date(campaign.scheduled_at ?? campaign.published_at ?? "").toLocaleTimeString(
                          "es-CO",
                          { hour: "2-digit", minute: "2-digit" },
                        )}
                      </p>
                    </div>
                    <CampaignStatusBadge status={campaign.status} />
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

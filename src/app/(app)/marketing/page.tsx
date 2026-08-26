import { redirect } from "next/navigation";
import { Sparkles, Users, UserPlus, Megaphone, Wallet, Coins } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PeriodFilter } from "@/components/reportes/period-filter";
import { MarketingNav } from "@/components/marketing/marketing-nav";
import { getSessionContext } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { resolveReportPeriod } from "@/lib/reportes";
import { formatCurrencyCents } from "@/lib/format";
import { LEAD_SOURCE_LABELS } from "@/lib/crm";
import type { LeadSource, MarketingCredits } from "@/types/database";

interface AttributionRow {
  source: LeadSource;
  customers_count: number;
  total_cents: number;
}

export default async function MarketingDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; start?: string; end?: string }>;
}) {
  const session = await getSessionContext();
  if (!session) redirect("/login");
  if (!session.activeCompany) redirect("/onboarding");
  if (!session.enabledFeatures.has("marketing")) redirect("/dashboard");

  const supabase = await createClient();
  const companyId = session.activeCompany.id;
  const timezone = session.activeCompany.timezone;
  const range = resolveReportPeriod(await searchParams, timezone);
  const startIso = range.start.toISOString();
  const endIso = range.end.toISOString();

  const [
    { count: leadsCount },
    { count: newCustomersCount },
    { count: activeCampaignsCount },
    { data: creditsData },
    { data: usageData },
    { data: attributionData },
  ] = await Promise.all([
    supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .gte("created_at", startIso)
      .lt("created_at", endIso),
    supabase
      .from("customers")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .gte("created_at", startIso)
      .lt("created_at", endIso),
    supabase
      .from("marketing_campaigns")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .not("status", "in", "(draft,finished)"),
    supabase.rpc("get_marketing_credits", { p_company_id: companyId }),
    supabase
      .from("marketing_credit_usage")
      .select("credits_spent")
      .eq("company_id", companyId)
      .gte("created_at", startIso)
      .lt("created_at", endIso),
    supabase.rpc("report_attribution_by_channel", {
      p_company_id: companyId,
      p_start: startIso,
      p_end: endIso,
    }),
  ]);

  const credits = creditsData as MarketingCredits | null;
  const creditsSpent = ((usageData ?? []) as { credits_spent: number }[]).reduce(
    (sum, row) => sum + row.credits_spent,
    0,
  );
  const attribution = ((attributionData ?? []) as unknown as AttributionRow[]).filter(
    (row) => row.customers_count > 0,
  );
  const totalAttributionCents = attribution.reduce((sum, row) => sum + row.total_cents, 0);

  return (
    <div>
      <PageHeader title="Marketing" description="Campañas, segmentos y atribución de tus clientes." />

      <MarketingNav />

      <div className="mb-5">
        <PeriodFilter />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard label="Leads" value={String(leadsCount ?? 0)} icon={UserPlus} />
        <StatCard label="Clientes nuevos" value={String(newCustomersCount ?? 0)} icon={Users} />
        <StatCard label="Campañas activas" value={String(activeCampaignsCount ?? 0)} icon={Megaphone} />
        <StatCard
          label="Créditos disponibles"
          value={credits ? String(credits.balance) : "—"}
          icon={Wallet}
        />
        <StatCard label="Créditos consumidos" value={String(creditsSpent)} icon={Coins} />
      </div>

      <div className="mt-6 rounded-xl border border-dashed border-brand/40 bg-brand/5 p-4">
        <div className="mb-2.5 flex items-start gap-2.5 text-sm">
          <Sparkles className="mt-0.5 size-4 shrink-0 text-brand" />
          <div>
            <p className="font-medium text-foreground">Plan de marketing con IA</p>
            <p className="mt-0.5 text-muted-foreground">
              Próximamente podrás pedirle a la IA un plan de marketing para tu negocio. Por ahora
              necesitas conectar un proveedor de IA (igual que el Asistente IA) para poder generarlo.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Input placeholder="Créame un plan de marketing para esta semana" disabled className="flex-1" />
          <Button disabled>Generar</Button>
        </div>
      </div>

      <section className="mt-8">
        <h2 className="mb-3 font-heading text-base font-semibold text-foreground">Atribución por canal</h2>
        {attribution.length === 0 ? (
          <EmptyState
            icon={Megaphone}
            title="Todavía no hay clientes atribuidos"
            description="Cuando tus clientes tengan un canal de origen registrado, aquí verás de dónde vienen y cuánto han comprado."
          />
        ) : (
          <div className="rounded-xl border border-border bg-card p-4">
            <ul className="space-y-3">
              {attribution.map((row) => {
                const pct = totalAttributionCents > 0 ? (row.total_cents / totalAttributionCents) * 100 : 0;
                return (
                  <li key={row.source}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-foreground">{LEAD_SOURCE_LABELS[row.source]}</span>
                      <span className="text-muted-foreground">
                        {formatCurrencyCents(row.total_cents)} · {row.customers_count} cliente
                        {row.customers_count === 1 ? "" : "s"}
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-brand" style={{ width: `${pct}%` }} />
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">{pct.toFixed(1)}%</p>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}

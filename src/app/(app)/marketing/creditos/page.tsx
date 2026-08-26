import { redirect } from "next/navigation";
import { History, Info, Wallet } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { StatCard } from "@/components/ui/stat-card";
import { MarketingNav } from "@/components/marketing/marketing-nav";
import { getSessionContext } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { MARKETING_CREDIT_ACTION_LABELS } from "@/lib/marketing";
import type { MarketingCreditCost, MarketingCredits, MarketingCreditUsage } from "@/types/database";

export default async function CreditosPage() {
  const session = await getSessionContext();
  if (!session) redirect("/login");
  if (!session.activeCompany) redirect("/onboarding");
  if (!session.enabledFeatures.has("marketing")) redirect("/dashboard");

  const supabase = await createClient();
  const companyId = session.activeCompany.id;

  const [{ data: creditsData }, { data: costsData }, { data: usageData }] = await Promise.all([
    supabase.rpc("get_marketing_credits", { p_company_id: companyId }),
    supabase.from("marketing_credit_costs").select("*").order("action_type"),
    supabase
      .from("marketing_credit_usage")
      .select("*")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(30),
  ]);

  const credits = creditsData as MarketingCredits | null;
  const costs = (costsData ?? []) as MarketingCreditCost[];
  const usage = (usageData ?? []) as MarketingCreditUsage[];

  return (
    <div>
      <PageHeader title="Créditos de marketing" description="Consumo y costos de las acciones de marketing." />

      <MarketingNav />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <StatCard
          label="Créditos disponibles"
          value={credits ? String(credits.balance) : "—"}
          icon={Wallet}
          hint={
            credits ? `Se reinician el ${new Date(credits.resets_at).toLocaleDateString("es-CO")}` : undefined
          }
        />
      </div>

      <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-dashed border-brand/40 bg-brand/5 p-4 text-sm">
        <Info className="mt-0.5 size-4 shrink-0 text-brand" />
        <p className="text-foreground">La compra de créditos adicionales estará disponible próximamente.</p>
      </div>

      <section className="mt-6">
        <h2 className="mb-3 font-heading text-base font-semibold text-foreground">Costo por acción</h2>
        <div className="rounded-xl border border-border bg-card p-4">
          <ul className="divide-y divide-border">
            {costs.map((cost) => (
              <li key={cost.action_type} className="flex items-center justify-between py-2 text-sm">
                <span className="text-foreground">{MARKETING_CREDIT_ACTION_LABELS[cost.action_type]}</span>
                <span className="text-muted-foreground">
                  {cost.credits_cost} crédito{cost.credits_cost === 1 ? "" : "s"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mt-6">
        <h2 className="mb-3 font-heading text-base font-semibold text-foreground">Historial de consumo</h2>
        {usage.length === 0 ? (
          <EmptyState
            icon={History}
            title="Sin consumo todavía"
            description="Cuando uses acciones de marketing que consuman créditos, aparecerán aquí."
          />
        ) : (
          <div className="rounded-xl border border-border bg-card p-4">
            <ul className="divide-y divide-border">
              {usage.map((row) => (
                <li key={row.id} className="flex items-center justify-between py-2 text-sm">
                  <span className="text-foreground">{MARKETING_CREDIT_ACTION_LABELS[row.action_type]}</span>
                  <span className="text-muted-foreground">
                    -{row.credits_spent} · {new Date(row.created_at).toLocaleString("es-CO")}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}

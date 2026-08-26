import { redirect } from "next/navigation";
import { Zap, Info } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { getSessionContext } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { PLAN_LIMIT_LABELS, formatLimitValue } from "@/lib/plans";
import { TemplateGrid } from "@/components/automatizaciones/template-grid";
import { AutomationList } from "@/components/automatizaciones/automation-list";
import type { Automation, PlanUsageRow } from "@/types/database";

export default async function AutomatizacionesPage() {
  const session = await getSessionContext();
  if (!session) redirect("/login");
  if (!session.activeCompany) redirect("/onboarding");
  if (!session.enabledFeatures.has("automation")) redirect("/dashboard");

  const supabase = await createClient();
  const companyId = session.activeCompany.id;

  const [{ data: automationsData }, { data: usageData }] = await Promise.all([
    supabase.from("automations").select("*").eq("company_id", companyId).order("created_at", { ascending: false }),
    supabase.rpc("get_plan_usage", { p_company_id: companyId }),
  ]);

  const automations = (automationsData ?? []) as Automation[];
  const activeTemplateKeys = automations
    .filter((a) => a.status !== "paused" && a.template_key)
    .map((a) => a.template_key as string);
  const usage = ((usageData as PlanUsageRow[] | null) ?? []).find((u) => u.limit_key === "max_automations_active");

  return (
    <div>
      <PageHeader title="Automatizaciones" description="Deja que bizko haga tareas repetitivas por ti." />

      {usage && (
        <div className="mb-5 rounded-xl border border-border bg-card p-4">
          <div className="flex items-baseline justify-between text-sm">
            <span className="text-muted-foreground">{PLAN_LIMIT_LABELS.max_automations_active}</span>
            <span className="font-medium text-foreground">
              {usage.current_usage} / {formatLimitValue("max_automations_active", usage.limit_value)}
            </span>
          </div>
        </div>
      )}

      <div className="mb-6 flex items-start gap-2.5 rounded-xl border border-dashed border-brand/40 bg-brand/5 p-4 text-sm">
        <Info className="mt-0.5 size-4 shrink-0 text-brand" />
        <p className="text-foreground">
          Ya puedes activar y organizar tus automatizaciones. La ejecución en tiempo real (avisos, correos,
          integraciones) se conectará muy pronto — por ahora, esto queda listo y guardado.
        </p>
      </div>

      <section className="mb-8">
        <h2 className="mb-3 font-heading text-base font-semibold text-foreground">Plantillas</h2>
        <TemplateGrid activeTemplateKeys={activeTemplateKeys} />
      </section>

      <section>
        <h2 className="mb-3 font-heading text-base font-semibold text-foreground">Tus automatizaciones</h2>
        {automations.length === 0 ? (
          <EmptyState
            icon={Zap}
            title="Todavía no tienes automatizaciones"
            description="Activa una plantilla para empezar."
          />
        ) : (
          <AutomationList automations={automations} />
        )}
      </section>
    </div>
  );
}

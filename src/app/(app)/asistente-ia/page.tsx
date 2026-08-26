import { redirect } from "next/navigation";
import { Sparkles, MessageCircleQuestion } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { getSessionContext } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { PLAN_LIMIT_LABELS, formatLimitValue, usagePct } from "@/lib/plans";
import type { PlanUsageRow } from "@/types/database";

const SUGGESTED_QUESTIONS = [
  "¿Cuánto vendí esta semana?",
  "¿Cuál fue mi producto más vendido?",
  "¿Qué productos tienen poco stock?",
  "¿Cómo estuvieron mis ventas este mes?",
  "¿Qué clientes compraron más?",
  "¿Cuál fue mi mejor día?",
  "¿Qué productos tienen baja rotación?",
];

export default async function AsistenteIaPage() {
  const session = await getSessionContext();
  if (!session) redirect("/login");
  if (!session.activeCompany) redirect("/onboarding");
  if (!session.enabledFeatures.has("ai")) redirect("/dashboard");

  const supabase = await createClient();
  const { data: usageData } = await supabase.rpc("get_plan_usage", { p_company_id: session.activeCompany.id });
  const usage = ((usageData as PlanUsageRow[] | null) ?? []).find((u) => u.limit_key === "max_ai_queries_month");
  const pct = usage ? usagePct(usage) : null;

  return (
    <div>
      <PageHeader title="Asistente IA" description="Pregúntale a tu negocio." />

      {usage && (
        <div className="mb-5 rounded-xl border border-border bg-card p-4">
          <div className="flex items-baseline justify-between text-sm">
            <span className="text-muted-foreground">{PLAN_LIMIT_LABELS.max_ai_queries_month}</span>
            <span className="font-medium text-foreground">
              {usage.current_usage} / {formatLimitValue("max_ai_queries_month", usage.limit_value)}
            </span>
          </div>
          {pct !== null && (
            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full rounded-full ${pct >= 100 ? "bg-destructive" : pct >= 80 ? "bg-warning" : "bg-brand"}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          )}
          {pct !== null && pct >= 100 && (
            <p className="mt-1.5 text-xs text-destructive">Has alcanzado tus consultas de IA de este período.</p>
          )}
          {pct !== null && pct >= 80 && pct < 100 && (
            <p className="mt-1.5 text-xs text-warning-foreground">Has utilizado el {pct}% de tus consultas de IA.</p>
          )}
        </div>
      )}

      <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-dashed border-brand/40 bg-brand/5 p-4 text-sm">
        <Sparkles className="mt-0.5 size-4 shrink-0 text-brand" />
        <p className="text-foreground">
          El asistente de IA estará disponible muy pronto. Aquí puedes ver cómo se va a ver — apenas se conecte,
          podrás preguntarle a tu negocio directamente.
        </p>
      </div>

      <div className="flex items-center gap-2">
        <Input placeholder="¿Qué quieres saber?" disabled className="flex-1" />
        <Button disabled>Preguntar</Button>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {SUGGESTED_QUESTIONS.map((q) => (
          <span
            key={q}
            className="rounded-full border border-border bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground"
          >
            {q}
          </span>
        ))}
      </div>

      <section className="mt-8">
        <h2 className="mb-3 font-heading text-base font-semibold text-foreground">Historial</h2>
        <EmptyState
          icon={MessageCircleQuestion}
          title="Todavía no has hecho consultas"
          description="Cuando el asistente esté disponible, tus preguntas anteriores aparecerán aquí."
        />
      </section>
    </div>
  );
}

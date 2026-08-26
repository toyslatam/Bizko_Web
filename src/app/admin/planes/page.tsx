import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { createClient } from "@/lib/supabase/server";
import { PlanEditorCard } from "@/components/admin/plan-editor-card";
import { CreditCard } from "lucide-react";
import type { FeatureDef, Plan, PlanFeature, PlanLimit } from "@/types/database";

interface PlanWithRelations extends Plan {
  plan_features: Pick<PlanFeature, "feature_key" | "enabled">[];
  plan_limits: Pick<PlanLimit, "limit_key" | "limit_value">[];
}

export default async function AdminPlanesPage() {
  const supabase = await createClient();

  const [{ data: plans }, { data: features }] = await Promise.all([
    supabase
      .from("plans")
      .select("*, plan_features(feature_key, enabled), plan_limits(limit_key, limit_value)")
      .order("price_monthly_cents"),
    supabase.from("features").select("*").order("name"),
  ]);

  const planRows = (plans ?? []) as unknown as PlanWithRelations[];
  const featureRows = (features ?? []) as FeatureDef[];

  return (
    <div>
      <PageHeader title="Planes" description="Precios, funciones y límites de cada plan de bizko." />

      {planRows.length === 0 ? (
        <EmptyState
          icon={CreditCard}
          title="No hay planes configurados"
          description="Los planes se crean desde la base de datos."
        />
      ) : (
        <div className="space-y-6">
          {planRows.map((plan) => (
            <PlanEditorCard key={plan.id} plan={plan} allFeatures={featureRows} />
          ))}
        </div>
      )}
    </div>
  );
}

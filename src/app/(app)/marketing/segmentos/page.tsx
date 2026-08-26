import { redirect } from "next/navigation";
import { Users } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { MarketingNav } from "@/components/marketing/marketing-nav";
import { SegmentFormDialog } from "@/components/marketing/segment-form-dialog";
import { getSessionContext } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { SEGMENT_CONDITION_LABELS } from "@/lib/marketing";
import type { MarketingSegment, ProductCategory } from "@/types/database";

function describeCondition(segment: MarketingSegment): string {
  const value = segment.condition_value as Record<string, unknown>;
  switch (segment.condition_type) {
    case "purchased_last_days":
      return `Compró en los últimos ${value.days} días`;
    case "inactive_days":
      return `Inactivo hace ${value.days} días`;
    case "category_id":
      return "Compradores de una categoría";
    case "min_total_spent":
      return `Gastó al menos $${Math.round(Number(value.min_cents ?? 0) / 100).toLocaleString("es-CO")}`;
    case "lead_source":
      return `Origen: ${value.source}`;
    default:
      return SEGMENT_CONDITION_LABELS[segment.condition_type];
  }
}

export default async function SegmentosPage() {
  const session = await getSessionContext();
  if (!session) redirect("/login");
  if (!session.activeCompany) redirect("/onboarding");
  if (!session.enabledFeatures.has("marketing")) redirect("/dashboard");

  const supabase = await createClient();
  const companyId = session.activeCompany.id;
  const canManage = Boolean(
    session.activeMembership && can(session.activeMembership.role, "marketing.gestionar"),
  );

  const [{ data: segmentsData }, { data: categoriesData }] = await Promise.all([
    supabase.from("marketing_segments").select("*").eq("company_id", companyId).order("created_at", { ascending: false }),
    supabase
      .from("product_categories")
      .select("*")
      .eq("company_id", companyId)
      .eq("status", "active")
      .order("name"),
  ]);

  const segments = (segmentsData ?? []) as MarketingSegment[];
  const categories = (categoriesData ?? []) as ProductCategory[];

  return (
    <div>
      <PageHeader
        title="Segmentos"
        description="Agrupa a tus clientes para dirigir mejor tus campañas."
        actions={canManage ? <SegmentFormDialog companyId={companyId} categories={categories} /> : undefined}
      />

      <MarketingNav />

      {segments.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Todavía no tienes segmentos"
          description="Crea un segmento para agrupar clientes por comportamiento u origen."
        />
      ) : (
        <div className="space-y-2">
          {segments.map((segment) => (
            <div key={segment.id} className="rounded-xl border border-border bg-card p-4">
              <p className="text-sm font-semibold text-foreground">{segment.name}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {SEGMENT_CONDITION_LABELS[segment.condition_type]} · {describeCondition(segment)}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

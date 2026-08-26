import { BarChart3, Building2, Users, Package, ShoppingCart, ClipboardList } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { UsagePeriodToggle } from "@/components/admin/usage-period-toggle";
import { createClient } from "@/lib/supabase/server";
import { getPeriodRange, type PeriodPreset } from "@/lib/date-range";

const ADMIN_TIMEZONE = "America/Bogota";

interface UsageMetrics {
  active_companies: number;
  active_users: number;
  products_count: number;
  sales_count: number;
  orders_count: number;
}

function presetFromPeriodParam(period: string | undefined): PeriodPreset {
  switch (period) {
    case "week":
      return "7d";
    case "month":
      return "this_month";
    case "day":
    default:
      return "today";
  }
}

export default async function AdminUsagePage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const { period } = await searchParams;
  const preset = presetFromPeriodParam(period);
  const range = getPeriodRange(preset, ADMIN_TIMEZONE);

  const supabase = await createClient();
  const { data } = await supabase
    .rpc("admin_usage_metrics", {
      p_start: range.start.toISOString(),
      p_end: range.end.toISOString(),
    })
    .single();

  const metrics = data as unknown as UsageMetrics | null;
  const allZero =
    !metrics ||
    (metrics.active_companies === 0 &&
      metrics.active_users === 0 &&
      metrics.products_count === 0 &&
      metrics.sales_count === 0 &&
      metrics.orders_count === 0);

  return (
    <div>
      <PageHeader title="Uso de la plataforma" description="Métricas agregadas de todos los negocios." />

      <div className="mb-4">
        <UsagePeriodToggle />
      </div>

      {allZero ? (
        <EmptyState
          icon={BarChart3}
          title="Sin actividad en este período"
          description="Todavía no hay datos de uso registrados para el rango seleccionado."
        />
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <StatCard
            label="Negocios con actividad"
            value={String(metrics.active_companies)}
            icon={Building2}
            hint="Con al menos una venta en el período"
          />
          <StatCard label="Usuarios activos" value={String(metrics.active_users)} icon={Users} />
          <StatCard label="Productos" value={String(metrics.products_count)} icon={Package} />
          <StatCard label="Ventas" value={String(metrics.sales_count)} icon={ShoppingCart} />
          <StatCard label="Pedidos" value={String(metrics.orders_count)} icon={ClipboardList} />
        </div>
      )}
    </div>
  );
}

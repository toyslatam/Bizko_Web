import { Building2, Users, CreditCard, DollarSign, ShoppingCart, ClipboardList, UserPlus, UserMinus } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { createClient } from "@/lib/supabase/server";
import { formatCurrencyCents } from "@/lib/format";
import { BUSINESS_MODULES } from "@/modules/registry";

interface DashboardMetrics {
  companies_total: number;
  companies_active: number;
  companies_trial: number;
  companies_suspended: number;
  users_total: number;
  subscriptions_active: number;
  mrr_cents: number;
  new_companies_month: number;
  canceled_month: number;
  orders_month: number;
  sales_month: number;
}

interface BusinessTypeRow {
  business_type: string;
  companies_count: number;
}

export default async function AdminDashboardPage() {
  const supabase = await createClient();

  const [{ data: metricsData }, { data: distributionData }] = await Promise.all([
    supabase.rpc("admin_dashboard_metrics").single(),
    supabase.rpc("admin_business_type_distribution"),
  ]);

  const metrics = metricsData as unknown as DashboardMetrics | null;
  const distribution = (distributionData as unknown as BusinessTypeRow[] | null) ?? [];
  const totalDistributed = distribution.reduce((sum, d) => sum + d.companies_count, 0);

  if (!metrics) {
    return (
      <div>
        <PageHeader title="Dashboard" description="Métricas principales de bizko." />
        <EmptyState
          icon={Building2}
          title="No pudimos cargar las métricas"
          description="Intenta de nuevo en unos minutos."
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Dashboard" description="Métricas principales de bizko." />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Empresas registradas" value={String(metrics.companies_total)} icon={Building2} />
        <StatCard label="Empresas activas" value={String(metrics.companies_active)} icon={Building2} />
        <StatCard label="En prueba" value={String(metrics.companies_trial)} icon={Building2} />
        <StatCard label="Suspendidas" value={String(metrics.companies_suspended)} icon={Building2} />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Usuarios registrados" value={String(metrics.users_total)} icon={Users} />
        <StatCard label="Suscripciones activas" value={String(metrics.subscriptions_active)} icon={CreditCard} />
        <StatCard label="MRR" value={formatCurrencyCents(metrics.mrr_cents)} icon={DollarSign} hint="Ingreso mensual recurrente" />
        <StatCard label="Nuevos negocios (mes)" value={String(metrics.new_companies_month)} icon={UserPlus} />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Cancelaciones (mes)" value={String(metrics.canceled_month)} icon={UserMinus} />
        <StatCard label="Pedidos procesados (mes)" value={String(metrics.orders_month)} icon={ClipboardList} />
        <StatCard label="Ventas procesadas (mes)" value={String(metrics.sales_month)} icon={ShoppingCart} />
      </div>

      <section className="mt-6">
        <h2 className="mb-3 font-heading text-base font-semibold text-foreground">
          Distribución por tipo de negocio
        </h2>
        {distribution.length === 0 ? (
          <EmptyState
            icon={Building2}
            title="Todavía no hay suficientes datos"
            description="Cuando existan negocios registrados, verás la distribución por vertical aquí."
          />
        ) : (
          <div className="rounded-xl border border-border bg-card p-4">
            <ul className="space-y-3">
              {distribution.map((d) => {
                const businessModule = BUSINESS_MODULES.find((m) => m.type === d.business_type);
                const pct = totalDistributed > 0 ? Math.round((d.companies_count / totalDistributed) * 100) : 0;
                return (
                  <li key={d.business_type}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-1.5 text-foreground">
                        <span>{businessModule?.emoji}</span>
                        {businessModule?.name ?? d.business_type}
                      </span>
                      <span className="text-muted-foreground">
                        {d.companies_count} · {pct}%
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-brand" style={{ width: `${pct}%` }} />
                    </div>
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

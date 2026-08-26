import { redirect } from "next/navigation";
import { Timer, DollarSign, BarChart3, UtensilsCrossed } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { getSessionContext } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { resolveReportPeriod } from "@/lib/reportes";
import { formatCurrencyCents } from "@/lib/format";
import { formatQuantity } from "@/lib/inventory";
import { SALE_SOURCE_LABELS } from "@/lib/sales";
import { PeriodFilter } from "@/components/reportes/period-filter";
import { SalesByHourChart, type SalesByHourPoint } from "@/components/reportes/sales-by-hour-chart";
import { SalesBySourceChart, type SalesBySourcePoint } from "@/components/reportes/sales-by-source-chart";
import type { SaleSource } from "@/types/database";

interface TopComboRow {
  name: string;
  quantity: number;
  total_cents: number;
}

export default async function RestauranteReportPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; start?: string; end?: string }>;
}) {
  const session = await getSessionContext();
  if (!session) redirect("/login");
  if (!session.activeCompany) redirect("/onboarding");
  if (!session.activeMembership || !can(session.activeMembership.role, "reportes.ver")) {
    redirect("/dashboard");
  }
  if (session.activeCompany.business_type !== "food") redirect("/reportes");

  const supabase = await createClient();
  const companyId = session.activeCompany.id;
  const timezone = session.activeCompany.timezone;
  const range = resolveReportPeriod(await searchParams, timezone);

  const [{ data: byHourData }, { data: bySourceData }, { data: topCombosData }, { data: avgPrepData }] =
    await Promise.all([
      supabase.rpc("report_sales_by_hour", {
        p_company_id: companyId,
        p_start: range.start.toISOString(),
        p_end: range.end.toISOString(),
        p_timezone: timezone,
      }),
      supabase.rpc("report_sales_by_order_type", {
        p_company_id: companyId,
        p_start: range.start.toISOString(),
        p_end: range.end.toISOString(),
      }),
      supabase.rpc("report_top_combos", {
        p_company_id: companyId,
        p_start: range.start.toISOString(),
        p_end: range.end.toISOString(),
        p_limit: 10,
      }),
      supabase.rpc("report_avg_prep_time_minutes", {
        p_company_id: companyId,
        p_start: range.start.toISOString(),
        p_end: range.end.toISOString(),
      }),
    ]);

  const byHour = (byHourData ?? []) as unknown as SalesByHourPoint[];
  const bySource = (bySourceData ?? []) as unknown as SalesBySourcePoint[];
  const topCombos = (topCombosData ?? []) as unknown as TopComboRow[];
  const avgPrepMinutes = avgPrepData as number | null;
  const totalSourceCents = bySource.reduce((sum, s) => sum + s.total_cents, 0);
  const hasSales = byHour.length > 0;

  return (
    <div>
      <PageHeader
        title="Restaurante"
        description="Horas pico, tipo de pedido, combos y tiempo de preparación."
      />

      <div className="mb-5">
        <PeriodFilter />
      </div>

      {!hasSales ? (
        <EmptyState
          icon={UtensilsCrossed}
          title="Todavía no hay ventas en este período."
          description="Ajusta el período o registra una venta para ver el reporte."
        />
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard
              label="Tiempo promedio de preparación"
              value={avgPrepMinutes !== null ? `${avgPrepMinutes} min` : "—"}
              icon={Timer}
              hint={avgPrepMinutes === null ? "sin pedidos con hora de listo" : undefined}
            />
            <StatCard
              label="Ventas totales"
              value={formatCurrencyCents(totalSourceCents)}
              icon={DollarSign}
            />
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-sm font-medium text-foreground">Ventas por hora</p>
            <p className="text-xs text-muted-foreground">Identifica tus horas pico.</p>
            <div className="mt-2">
              <SalesByHourChart data={byHour} />
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-sm font-medium text-foreground">Ventas por tipo de pedido</p>
              {bySource.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">
                  No hay ventas en este período.
                </p>
              ) : (
                <SalesBySourceChart data={bySource} />
              )}
            </div>

            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-sm font-medium text-foreground">Detalle por tipo de pedido</p>
              {bySource.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">
                  No hay ventas en este período.
                </p>
              ) : (
                <ul className="mt-3 space-y-3">
                  {bySource.map((s) => {
                    const pct = totalSourceCents > 0 ? (s.total_cents / totalSourceCents) * 100 : 0;
                    return (
                      <li key={s.source}>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-foreground">
                            {SALE_SOURCE_LABELS[s.source as SaleSource]}
                          </span>
                          <span className="text-muted-foreground">
                            {formatCurrencyCents(s.total_cents)} · {s.sales_count} venta
                            {s.sales_count === 1 ? "" : "s"}
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
              )}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-sm font-medium text-foreground">Combos más vendidos</p>
            {topCombos.length === 0 ? (
              <EmptyState
                icon={BarChart3}
                title="Sin ranking de combos"
                description="Todavía no hay suficientes ventas de combos para mostrar un ranking."
                className="mt-3"
              />
            ) : (
              <ul className="mt-3 space-y-3">
                {topCombos.map((c, i) => (
                  <li key={c.name} className="flex items-center gap-3">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                      {i + 1}
                    </span>
                    <span className="flex-1 truncate text-sm text-foreground">{c.name}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatQuantity(c.quantity)} vendidos
                    </span>
                    <span className="shrink-0 text-sm font-medium text-foreground">
                      {formatCurrencyCents(c.total_cents)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

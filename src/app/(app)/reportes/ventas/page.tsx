import { redirect } from "next/navigation";
import { DollarSign, Receipt, ShoppingBag, Package } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { getSessionContext } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { resolveReportPeriod } from "@/lib/reportes";
import { formatCurrencyCents } from "@/lib/format";
import { formatQuantity } from "@/lib/inventory";
import { PAYMENT_METHOD_LABELS, SALE_STATUS_LABELS } from "@/lib/sales";
import { PeriodFilter } from "@/components/reportes/period-filter";
import { CsvExportButton } from "@/components/reportes/csv-export-button";
import { SalesByDayChart, type SalesByDayPoint } from "@/components/reportes/sales-by-day-chart";
import { SaleList, type SaleRow } from "@/components/ventas/sale-list";
import { customerFullName } from "@/lib/catalog";
import type { PaymentMethod } from "@/types/database";

interface SalesSummaryRow {
  total_cents: number;
  sales_count: number;
  avg_ticket_cents: number;
  products_qty: number;
  services_qty: number;
}

interface PaymentMethodRow {
  payment_method: PaymentMethod;
  total_cents: number;
  movement_count: number;
}

interface SaleCsvRow {
  fecha: string;
  numero: string;
  cliente: string;
  usuario: string;
  total: string;
  metodo: string;
  estado: string;
}

function saleUserLabel(sale: SaleRow) {
  if (!sale.user) return "—";
  const name = [sale.user.first_name, sale.user.last_name].filter(Boolean).join(" ");
  return name || sale.user.email.split("@")[0];
}

export default async function VentasReportPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; start?: string; end?: string }>;
}) {
  const session = await getSessionContext();
  if (!session) redirect("/login");
  if (!session.activeCompany) redirect("/onboarding");
  if (!session.activeMembership || !can(session.activeMembership.role, "reportes.ver")) redirect("/dashboard");

  const supabase = await createClient();
  const companyId = session.activeCompany.id;
  const timezone = session.activeCompany.timezone;
  const range = resolveReportPeriod(await searchParams, timezone);

  const [{ data: summaryData }, { data: byDay }, { data: byMethodData }, { data: sales }] = await Promise.all([
    supabase
      .rpc("report_sales_summary", {
        p_company_id: companyId,
        p_start: range.start.toISOString(),
        p_end: range.end.toISOString(),
      })
      .single(),
    supabase.rpc("report_sales_by_day", {
      p_company_id: companyId,
      p_start: range.start.toISOString(),
      p_end: range.end.toISOString(),
      p_timezone: timezone,
    }),
    supabase.rpc("report_payment_methods", {
      p_company_id: companyId,
      p_start: range.start.toISOString(),
      p_end: range.end.toISOString(),
    }),
    supabase
      .from("sales")
      .select("*, customer:customers(first_name,last_name), user:profiles(first_name,last_name,email)")
      .eq("company_id", companyId)
      .eq("status", "completed")
      .gte("created_at", range.start.toISOString())
      .lt("created_at", range.end.toISOString())
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  const summary = summaryData as unknown as SalesSummaryRow | null;
  const salesByDay = (byDay ?? []) as unknown as SalesByDayPoint[];
  const paymentMethods = (byMethodData ?? []) as unknown as PaymentMethodRow[];
  const salesCount = summary?.sales_count ?? 0;
  const saleRows = (sales ?? []) as unknown as SaleRow[];
  const totalPaymentCents = paymentMethods.reduce((sum, m) => sum + m.total_cents, 0);

  const csvRows: SaleCsvRow[] = saleRows.map((sale) => ({
    fecha: new Date(sale.created_at).toLocaleString("es-CO"),
    numero: sale.sale_number,
    cliente: sale.customer ? customerFullName(sale.customer) : "Cliente general",
    usuario: saleUserLabel(sale),
    total: formatCurrencyCents(sale.total_cents),
    metodo: PAYMENT_METHOD_LABELS[sale.payment_method],
    estado: SALE_STATUS_LABELS[sale.status],
  }));

  return (
    <div>
      <PageHeader
        title="Ventas"
        description="Total vendido, ticket promedio y métodos de pago del período."
        actions={
          <CsvExportButton
            filename={`ventas-${range.label}.csv`}
            rows={csvRows}
            columns={[
              { key: "fecha", label: "Fecha" },
              { key: "numero", label: "Número" },
              { key: "cliente", label: "Cliente" },
              { key: "usuario", label: "Usuario" },
              { key: "total", label: "Total" },
              { key: "metodo", label: "Método" },
              { key: "estado", label: "Estado" },
            ]}
          />
        }
      />

      <div className="mb-5">
        <PeriodFilter />
      </div>

      {salesCount === 0 ? (
        <EmptyState
          icon={DollarSign}
          title="Todavía no hay ventas en este período."
          description="Ajusta el período o registra una venta para ver el reporte."
        />
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard
              label="Total vendido"
              value={formatCurrencyCents(summary?.total_cents ?? 0)}
              icon={DollarSign}
            />
            <StatCard
              label="Número de ventas"
              value={String(salesCount)}
              icon={Receipt}
            />
            <StatCard
              label="Ticket promedio"
              value={formatCurrencyCents(summary?.avg_ticket_cents ?? 0)}
              icon={ShoppingBag}
            />
            <StatCard
              label="Productos / servicios vendidos"
              value={`${formatQuantity(summary?.products_qty ?? 0)} / ${formatQuantity(summary?.services_qty ?? 0)}`}
              icon={Package}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <div className="rounded-xl border border-border bg-card p-4 lg:col-span-2">
              <p className="text-sm font-medium text-foreground">Ventas por día</p>
              <div className="mt-2">
                <SalesByDayChart data={salesByDay} />
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-sm font-medium text-foreground">Métodos de pago</p>
              {paymentMethods.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">
                  No hay movimientos de pago en este período.
                </p>
              ) : (
                <ul className="mt-3 space-y-3">
                  {paymentMethods.map((m) => {
                    const pct = totalPaymentCents > 0 ? (m.total_cents / totalPaymentCents) * 100 : 0;
                    return (
                      <li key={m.payment_method}>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-foreground">
                            {PAYMENT_METHOD_LABELS[m.payment_method]}
                          </span>
                          <span className="text-muted-foreground">{formatCurrencyCents(m.total_cents)}</span>
                        </div>
                        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-brand"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">{pct.toFixed(1)}%</p>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm font-medium text-foreground">Ventas del período</p>
            <SaleList sales={saleRows} />
            {saleRows.length === 100 && (
              <p className="mt-2 text-xs text-muted-foreground">
                Se muestran las primeras 100 ventas del período. Usa el filtro de fechas para acotar el rango.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

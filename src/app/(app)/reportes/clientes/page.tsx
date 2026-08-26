import { redirect } from "next/navigation";
import { Users, UserPlus, Repeat, UserX } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { getSessionContext } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { resolveReportPeriod } from "@/lib/reportes";
import { formatCurrencyCents } from "@/lib/format";
import { customerFullName } from "@/lib/catalog";
import { PeriodFilter } from "@/components/reportes/period-filter";
import { CsvExportButton } from "@/components/reportes/csv-export-button";

interface TopCustomerRow {
  customer_id: string;
  first_name: string;
  last_name: string;
  purchases_count: number;
  total_cents: number;
  last_purchase: string;
}

interface CustomerCsvRow {
  cliente: string;
  compras: number;
  total: string;
  ultima_compra: string;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" });
}

export default async function ClientesReportPage({
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
  const range = resolveReportPeriod(await searchParams, session.activeCompany.timezone);
  const recentCutoff = new Date(new Date().getTime() - 60 * 86400000).toISOString();

  const [
    { data: activeCustomers },
    { count: newCustomersCount },
    { data: periodSales },
    { data: recentSales },
    { data: topCustomers },
  ] = await Promise.all([
    supabase.from("customers").select("id").eq("company_id", companyId).eq("status", "active"),
    supabase
      .from("customers")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .gte("created_at", range.start.toISOString())
      .lt("created_at", range.end.toISOString()),
    supabase
      .from("sales")
      .select("customer_id")
      .eq("company_id", companyId)
      .eq("status", "completed")
      .gte("created_at", range.start.toISOString())
      .lt("created_at", range.end.toISOString())
      .not("customer_id", "is", null),
    supabase.from("sales").select("customer_id").eq("company_id", companyId).gte("created_at", recentCutoff).not("customer_id", "is", null),
    supabase.rpc("report_top_customers", {
      p_company_id: companyId,
      p_start: range.start.toISOString(),
      p_end: range.end.toISOString(),
      p_limit: 10,
    }),
  ]);

  const purchasesByCustomer = new Map<string, number>();
  for (const row of periodSales ?? []) {
    const id = row.customer_id as string;
    purchasesByCustomer.set(id, (purchasesByCustomer.get(id) ?? 0) + 1);
  }
  const recurringCustomersCount = Array.from(purchasesByCustomer.values()).filter((count) => count > 1).length;

  const recentCustomerIds = new Set((recentSales ?? []).map((row) => row.customer_id as string));
  const activeCount = activeCustomers?.length ?? 0;
  const activeWithoutRecentPurchase = (activeCustomers ?? []).filter((row) => !recentCustomerIds.has(row.id as string)).length;

  const topCustomerRows = (topCustomers ?? []) as TopCustomerRow[];

  const csvRows: CustomerCsvRow[] = topCustomerRows.map((c) => ({
    cliente: customerFullName({ first_name: c.first_name, last_name: c.last_name }),
    compras: c.purchases_count,
    total: formatCurrencyCents(c.total_cents),
    ultima_compra: formatDate(c.last_purchase),
  }));

  return (
    <div>
      <PageHeader
        title="Clientes"
        description="Quiénes compran más y quiénes no han vuelto."
        actions={
          <CsvExportButton
            filename={`clientes-${range.label}.csv`}
            rows={csvRows}
            columns={[
              { key: "cliente", label: "Cliente" },
              { key: "compras", label: "Compras" },
              { key: "total", label: "Total" },
              { key: "ultima_compra", label: "Última compra" },
            ]}
          />
        }
      />

      <div className="mb-5">
        <PeriodFilter />
      </div>

      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Clientes activos" value={String(activeCount)} icon={Users} />
          <StatCard label="Nuevos clientes" value={String(newCustomersCount ?? 0)} icon={UserPlus} />
          <StatCard label="Clientes recurrentes" value={String(recurringCustomersCount)} icon={Repeat} hint="Con más de 1 compra en el período" />
          <StatCard
            label="Clientes sin compras recientes"
            value={String(activeWithoutRecentPurchase)}
            icon={UserX}
            hint="Sin compras en los últimos 60 días"
          />
        </div>

        <div>
          <p className="mb-2 text-sm font-medium text-foreground">Clientes con mayor volumen de compra</p>
          {topCustomerRows.length === 0 ? (
            <EmptyState
              icon={Users}
              title="Todavía no hay compras registradas en este período."
              description="Ajusta el período para ver el ranking de clientes."
            />
          ) : (
            <div className="rounded-xl border border-border bg-card p-4">
              <ul className="space-y-3">
                {topCustomerRows.map((c, i) => (
                  <li key={c.customer_id} className="flex items-center gap-3">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                      {i + 1}
                    </span>
                    <span className="flex-1 truncate text-sm text-foreground">
                      {customerFullName({ first_name: c.first_name, last_name: c.last_name })}
                    </span>
                    <span className="text-xs text-muted-foreground">{c.purchases_count} compras</span>
                    <span className="w-28 text-right text-sm font-medium text-foreground">
                      {formatCurrencyCents(c.total_cents)}
                    </span>
                    <span className="w-24 text-right text-xs text-muted-foreground">{formatDate(c.last_purchase)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

import { redirect } from "next/navigation";
import { Receipt } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { getSessionContext } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { resolveReportPeriod } from "@/lib/reportes";
import { formatCurrencyCents } from "@/lib/format";
import { PeriodFilter } from "@/components/reportes/period-filter";
import { CsvExportButton } from "@/components/reportes/csv-export-button";
import { ExpensesByDayChart } from "@/components/reportes/expenses-by-day-chart";
import { cn } from "@/lib/utils";

interface ExpenseCategoryCsvRow {
  categoria: string;
  total: string;
}

interface ExpenseCategoryRow {
  category_id: string | null;
  category_name: string;
  total_cents: number;
}

interface ExpenseByDayRow {
  day: string;
  total_cents: number;
}

interface OperatingResultRow {
  sales_total_cents: number;
  expenses_total_cents: number;
  operating_result_cents: number;
}

export default async function GastosReportPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; start?: string; end?: string }>;
}) {
  const session = await getSessionContext();
  if (!session) redirect("/login");
  if (!session.activeCompany) redirect("/onboarding");
  if (!session.activeMembership || !can(session.activeMembership.role, "reportes.ver")) redirect("/dashboard");
  if (!can(session.activeMembership.role, "finanzas.ver")) redirect("/reportes");

  const supabase = await createClient();
  const companyId = session.activeCompany.id;
  const timezone = session.activeCompany.timezone;
  const range = resolveReportPeriod(await searchParams, timezone);

  const [{ data: byCategory }, { data: byDay }, { data: operatingResult }] = await Promise.all([
    supabase.rpc("report_expenses_by_category", {
      p_company_id: companyId,
      p_start: range.start.toISOString(),
      p_end: range.end.toISOString(),
    }),
    supabase.rpc("report_expenses_by_day", {
      p_company_id: companyId,
      p_start: range.start.toISOString(),
      p_end: range.end.toISOString(),
      p_timezone: timezone,
    }),
    supabase
      .rpc("report_operating_result", {
        p_company_id: companyId,
        p_start: range.start.toISOString(),
        p_end: range.end.toISOString(),
      })
      .single(),
  ]);

  const categories = (byCategory ?? []) as ExpenseCategoryRow[];
  const expensesByDay = (byDay ?? []) as ExpenseByDayRow[];
  const totalExpensesCents = categories.reduce((sum, c) => sum + c.total_cents, 0);
  const hasExpenses = categories.length > 0;

  const result = operatingResult as OperatingResultRow | null;
  const salesTotalCents = result?.sales_total_cents ?? 0;
  const expensesTotalCents = result?.expenses_total_cents ?? 0;
  const operatingResultCents = result?.operating_result_cents ?? 0;
  const isPositiveResult = operatingResultCents >= 0;

  const csvRows: ExpenseCategoryCsvRow[] = categories.map((c) => ({
    categoria: c.category_name,
    total: formatCurrencyCents(c.total_cents),
  }));

  return (
    <div>
      <PageHeader
        title="Gastos"
        description="Gastos por categoría y resultado operativo del período."
        actions={
          <CsvExportButton
            filename={`gastos-${range.label}.csv`}
            rows={csvRows}
            columns={[
              { key: "categoria", label: "Categoría" },
              { key: "total", label: "Total" },
            ]}
          />
        }
      />

      <div className="mb-5">
        <PeriodFilter />
      </div>

      <div className="space-y-6">
        {hasExpenses ? (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <StatCard
                label="Total de gastos"
                value={formatCurrencyCents(totalExpensesCents)}
                icon={Receipt}
              />
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <div className="rounded-xl border border-border bg-card p-4 lg:col-span-2">
                <p className="text-sm font-medium text-foreground">Evolución de gastos</p>
                <div className="mt-2">
                  <ExpensesByDayChart data={expensesByDay} />
                </div>
              </div>

              <div className="rounded-xl border border-border bg-card p-4">
                <p className="text-sm font-medium text-foreground">Gastos por categoría</p>
                <ul className="mt-3 space-y-3">
                  {categories.map((c, i) => (
                    <li key={c.category_id ?? c.category_name} className="flex items-center gap-3">
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                        {i + 1}
                      </span>
                      <span className="flex-1 truncate text-sm text-foreground">{c.category_name}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatCurrencyCents(c.total_cents)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </>
        ) : (
          <EmptyState
            icon={Receipt}
            title="Todavía no has registrado gastos en este período."
            description="Ajusta el período o registra un gasto para ver el reporte."
          />
        )}

        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-sm font-medium text-foreground">Resultado del negocio</p>
          <div className="mt-3 space-y-1.5 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Ventas</span>
              <span className="font-medium text-foreground">{formatCurrencyCents(salesTotalCents)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">− Gastos</span>
              <span className="font-medium text-foreground">{formatCurrencyCents(expensesTotalCents)}</span>
            </div>
            <div className="flex items-center justify-between border-t border-border pt-1.5">
              <span className="font-medium text-foreground">= Resultado operativo aproximado</span>
              <span
                className={cn(
                  "font-heading text-base font-semibold",
                  isPositiveResult ? "text-success" : "text-destructive",
                )}
              >
                {formatCurrencyCents(operatingResultCents)}
              </span>
            </div>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Este resultado es una referencia operativa aproximada — no reemplaza un estado
            financiero formal ni un cálculo contable.
          </p>
        </div>
      </div>
    </div>
  );
}

import { redirect } from "next/navigation";
import Link from "next/link";
import { Wallet, ArrowDownCircle, ArrowUpCircle, Scale } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { getSessionContext } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { resolveReportPeriod } from "@/lib/reportes";
import { formatCurrencyCents } from "@/lib/format";
import { PAYMENT_METHOD_LABELS } from "@/lib/sales";
import { PeriodFilter } from "@/components/reportes/period-filter";
import { CsvExportButton } from "@/components/reportes/csv-export-button";
import { CashRegistersList } from "@/components/reportes/cash-registers-list";
import type { CashMovementType, CashRegister, PaymentMethod } from "@/types/database";

interface PaymentMethodCsvRow {
  metodo: string;
  total: string;
  movimientos: string;
}

interface CashMovementRow {
  movement_type: CashMovementType;
  amount_cents: number;
}

interface PaymentMethodRow {
  payment_method: PaymentMethod;
  total_cents: number;
  movement_count: number;
}

export default async function CajaReportPage({
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

  const [{ data: movements }, { data: byMethod }, { data: closedRegisters }] = await Promise.all([
    supabase
      .from("cash_movements")
      .select("movement_type, amount_cents")
      .eq("company_id", companyId)
      .gte("created_at", range.start.toISOString())
      .lt("created_at", range.end.toISOString()),
    supabase.rpc("report_payment_methods", {
      p_company_id: companyId,
      p_start: range.start.toISOString(),
      p_end: range.end.toISOString(),
    }),
    supabase
      .from("cash_registers")
      .select("*")
      .eq("company_id", companyId)
      .eq("status", "closed")
      .gte("closed_at", range.start.toISOString())
      .lt("closed_at", range.end.toISOString())
      .order("closed_at", { ascending: false }),
  ]);

  const movementRows = (movements ?? []) as CashMovementRow[];
  const incomeCents = movementRows
    .filter((m) => m.movement_type === "income")
    .reduce((sum, m) => sum + m.amount_cents, 0);
  const expenseCents = movementRows
    .filter((m) => m.movement_type === "expense")
    .reduce((sum, m) => sum + m.amount_cents, 0);
  const balanceCents = movementRows.reduce((sum, m) => sum + m.amount_cents, 0);

  const paymentMethods = (byMethod ?? []) as PaymentMethodRow[];
  const totalPaymentCents = paymentMethods.reduce((sum, m) => sum + m.total_cents, 0);
  const registers = (closedRegisters ?? []) as CashRegister[];

  const csvRows: PaymentMethodCsvRow[] = paymentMethods.map((m) => ({
    metodo: PAYMENT_METHOD_LABELS[m.payment_method],
    total: formatCurrencyCents(m.total_cents),
    movimientos: String(m.movement_count),
  }));

  return (
    <div>
      <PageHeader
        title="Caja"
        description="Ingresos, egresos y diferencias de cierre del período."
        actions={
          <CsvExportButton
            filename={`caja-${range.label}.csv`}
            rows={csvRows}
            columns={[
              { key: "metodo", label: "Método" },
              { key: "total", label: "Total" },
              { key: "movimientos", label: "Movimientos" },
            ]}
          />
        }
      />

      <div className="mb-5">
        <PeriodFilter />
      </div>

      {movementRows.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title="Todavía no hay movimientos de caja en este período."
          description="Ajusta el período o registra un movimiento de caja para ver el reporte."
        />
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            <StatCard
              label="Ingresos"
              value={formatCurrencyCents(incomeCents)}
              icon={ArrowUpCircle}
            />
            <StatCard
              label="Egresos"
              value={formatCurrencyCents(Math.abs(expenseCents))}
              icon={ArrowDownCircle}
            />
            <StatCard
              label="Saldo"
              value={formatCurrencyCents(balanceCents)}
              icon={Scale}
            />
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-sm font-medium text-foreground">Movimientos por método de pago</p>
            {paymentMethods.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">
                No hay ingresos registrados en este período.
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
                        <span className="text-muted-foreground">
                          {formatCurrencyCents(m.total_cents)} · {m.movement_count} mov.
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-brand" style={{ width: `${pct}%` }} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-medium text-foreground">Diferencias de caja</p>
              <Link href="/caja/historial" className="text-sm font-medium text-brand hover:underline">
                Consultar cierres anteriores
              </Link>
            </div>
            {registers.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay cierres de caja en este período.</p>
            ) : (
              <CashRegistersList registers={registers} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

import { redirect } from "next/navigation";
import { Package, Wrench } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { getSessionContext } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { resolveReportPeriod } from "@/lib/reportes";
import { PeriodFilter } from "@/components/reportes/period-filter";
import { CsvExportButton } from "@/components/reportes/csv-export-button";
import { formatCurrencyCents } from "@/lib/format";
import { formatQuantity } from "@/lib/inventory";
import { UNIT_SHORT_LABELS } from "@/lib/catalog";
import type { ProductUnit } from "@/types/database";
import type { CsvColumn } from "@/lib/csv";

interface TopProductRow {
  product_id: string | null;
  name: string;
  unit: ProductUnit;
  quantity: number;
  total_cents: number;
}

interface TopServiceRow {
  service_id: string | null;
  name: string;
  quantity: number;
  total_cents: number;
}

function formatProductQuantity(quantity: number, unit: ProductUnit): string {
  return `${formatQuantity(quantity)} ${UNIT_SHORT_LABELS[unit]}`;
}

function RankedList({
  items,
}: {
  items: { key: string; name: string; quantityLabel: string; totalCents: number }[];
}) {
  return (
    <ul className="mt-3 space-y-3">
      {items.map((item, i) => (
        <li key={item.key} className="flex items-center gap-3">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
            {i + 1}
          </span>
          <span className="flex-1 truncate text-sm text-foreground">{item.name}</span>
          <span className="shrink-0 text-xs text-muted-foreground">{item.quantityLabel}</span>
          <span className="shrink-0 text-sm font-medium text-foreground">
            {formatCurrencyCents(item.totalCents)}
          </span>
        </li>
      ))}
    </ul>
  );
}

export default async function ProductosReportPage({
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

  const supabase = await createClient();
  const companyId = session.activeCompany.id;
  const range = resolveReportPeriod(await searchParams, session.activeCompany.timezone);

  const [{ data: topProductsData }, { data: topServicesData }, { count: servicesCount }] =
    await Promise.all([
      supabase.rpc("report_top_products", {
        p_company_id: companyId,
        p_start: range.start.toISOString(),
        p_end: range.end.toISOString(),
        p_limit: 15,
      }),
      supabase.rpc("report_top_services", {
        p_company_id: companyId,
        p_start: range.start.toISOString(),
        p_end: range.end.toISOString(),
        p_limit: 15,
      }),
      supabase.from("services").select("id", { count: "exact", head: true }).eq("company_id", companyId),
    ]);

  const topProducts = (topProductsData ?? []) as unknown as TopProductRow[];
  const topServices = (topServicesData ?? []) as unknown as TopServiceRow[];
  const hasServices = (servicesCount ?? 0) > 0;

  const csvRows = topProducts.map((p) => ({
    producto: p.name,
    unidades: formatQuantity(p.quantity),
    ventas: formatCurrencyCents(p.total_cents),
  }));
  const csvColumns: CsvColumn<(typeof csvRows)[number]>[] = [
    { key: "producto", label: "Producto" },
    { key: "unidades", label: "Unidades" },
    { key: "ventas", label: "Ventas" },
  ];

  return (
    <div>
      <PageHeader
        title="Productos y servicios"
        actions={<CsvExportButton filename="productos.csv" rows={csvRows} columns={csvColumns} />}
      />

      <div className="mb-4">
        <PeriodFilter />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-sm font-medium text-foreground">Top productos</p>
          {topProducts.length === 0 ? (
            <EmptyState
              icon={Package}
              title="Sin ranking de productos"
              description="Todavía no hay suficientes ventas para mostrar un ranking de productos."
              className="mt-3"
            />
          ) : (
            <RankedList
              items={topProducts.map((p) => ({
                key: p.product_id ?? p.name,
                name: p.name,
                quantityLabel: formatProductQuantity(p.quantity, p.unit),
                totalCents: p.total_cents,
              }))}
            />
          )}
        </div>

        {hasServices && (
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-sm font-medium text-foreground">Top servicios</p>
            {topServices.length === 0 ? (
              <EmptyState
                icon={Wrench}
                title="Sin servicios vendidos"
                description="No se vendieron servicios en este período."
                className="mt-3"
              />
            ) : (
              <RankedList
                items={topServices.map((s) => ({
                  key: s.service_id ?? s.name,
                  name: s.name,
                  quantityLabel: `${formatQuantity(s.quantity)} serv.`,
                  totalCents: s.total_cents,
                }))}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

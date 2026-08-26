import { redirect } from "next/navigation";
import { ClipboardList } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { MobileList, MobileListItem } from "@/components/ui/mobile-list";
import { getSessionContext } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { resolveReportPeriod } from "@/lib/reportes";
import { formatCurrencyCents } from "@/lib/format";
import { PeriodFilter } from "@/components/reportes/period-filter";
import { CsvExportButton } from "@/components/reportes/csv-export-button";

interface SummaryCsvRow {
  metrica: string;
  valor: string;
}

interface OrdersSummaryRow {
  received: number;
  confirmed: number;
  canceled: number;
  delivered: number;
  pending: number;
  total_value_cents: number;
  pickup_count: number;
  delivery_count: number;
  cod_count: number;
}

interface DeliverySummaryRow {
  delivered: number;
  failed: number;
  delivery_fee_total_cents: number;
  cod_orders: number;
}

interface DeliveryByZoneRow {
  zone_id: string | null;
  zone_name: string;
  orders_count: number;
  total_cents: number;
}

export default async function PedidosReportPage({
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
  const deliveryEnabled = session.activeCompany.delivery_enabled;
  const range = resolveReportPeriod(await searchParams, session.activeCompany.timezone);

  const [{ data: ordersSummary }, { data: deliverySummary }, { data: byZone }] = await Promise.all([
    supabase
      .rpc("report_orders_summary", {
        p_company_id: companyId,
        p_start: range.start.toISOString(),
        p_end: range.end.toISOString(),
      })
      .single(),
    deliveryEnabled
      ? supabase
          .rpc("report_delivery_summary", {
            p_company_id: companyId,
            p_start: range.start.toISOString(),
            p_end: range.end.toISOString(),
          })
          .single()
      : Promise.resolve({ data: null }),
    deliveryEnabled
      ? supabase.rpc("report_delivery_by_zone", {
          p_company_id: companyId,
          p_start: range.start.toISOString(),
          p_end: range.end.toISOString(),
        })
      : Promise.resolve({ data: null }),
  ]);

  const summary = ordersSummary as unknown as OrdersSummaryRow | null;
  const delivery = deliverySummary as unknown as DeliverySummaryRow | null;
  const zones = (byZone ?? []) as unknown as DeliveryByZoneRow[];

  const receivedCount = summary?.received ?? 0;

  const csvRows: SummaryCsvRow[] = [
    { metrica: "Recibidos", valor: String(summary?.received ?? 0) },
    { metrica: "Confirmados", valor: String(summary?.confirmed ?? 0) },
    { metrica: "Cancelados", valor: String(summary?.canceled ?? 0) },
    { metrica: "Entregados", valor: String(summary?.delivered ?? 0) },
    { metrica: "Pendientes", valor: String(summary?.pending ?? 0) },
    { metrica: "Valor total", valor: formatCurrencyCents(summary?.total_value_cents ?? 0) },
    { metrica: "Recogida en tienda", valor: String(summary?.pickup_count ?? 0) },
    { metrica: "Domicilio", valor: String(summary?.delivery_count ?? 0) },
    { metrica: "Contra entrega", valor: String(summary?.cod_count ?? 0) },
    ...(deliveryEnabled
      ? [
          { metrica: "Entregas realizadas", valor: String(delivery?.delivered ?? 0) },
          { metrica: "Entregas fallidas", valor: String(delivery?.failed ?? 0) },
          { metrica: "Costo de delivery", valor: formatCurrencyCents(delivery?.delivery_fee_total_cents ?? 0) },
        ]
      : []),
  ];

  return (
    <div>
      <PageHeader
        title="Pedidos"
        description="Pedidos por estado, tipo de entrega y zona del período."
        actions={
          <CsvExportButton
            filename={`pedidos-${range.label}.csv`}
            rows={csvRows}
            columns={[
              { key: "metrica", label: "Métrica" },
              { key: "valor", label: "Valor" },
            ]}
          />
        }
      />

      <div className="mb-5">
        <PeriodFilter />
      </div>

      {receivedCount === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="Todavía no hay pedidos en este período."
          description="Ajusta el período o registra un pedido para ver el reporte."
        />
      ) : (
        <div className="space-y-8">
          <section>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <StatCard label="Recibidos" value={String(summary?.received ?? 0)} />
              <StatCard label="Confirmados" value={String(summary?.confirmed ?? 0)} />
              <StatCard label="Cancelados" value={String(summary?.canceled ?? 0)} />
              <StatCard label="Entregados" value={String(summary?.delivered ?? 0)} />
              <StatCard label="Pendientes" value={String(summary?.pending ?? 0)} />
              <StatCard label="Valor total" value={formatCurrencyCents(summary?.total_value_cents ?? 0)} />
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-foreground">
                Recogida en tienda: {summary?.pickup_count ?? 0}
              </span>
              <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-foreground">
                Domicilio: {summary?.delivery_count ?? 0}
              </span>
              <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-foreground">
                Contra entrega: {summary?.cod_count ?? 0}
              </span>
            </div>
          </section>

          {deliveryEnabled && (
            <section>
              <h2 className="mb-3 font-heading text-base font-semibold text-foreground">Delivery</h2>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatCard label="Entregas realizadas" value={String(delivery?.delivered ?? 0)} />
                <StatCard label="Entregas fallidas" value={String(delivery?.failed ?? 0)} />
                <StatCard
                  label="Costo de delivery"
                  value={formatCurrencyCents(delivery?.delivery_fee_total_cents ?? 0)}
                />
                <StatCard label="Pedidos contra entrega" value={String(delivery?.cod_orders ?? 0)} />
              </div>

              <div className="mt-4">
                <p className="mb-2 text-sm font-medium text-foreground">Pedidos por zona</p>
                {zones.length === 0 ? (
                  <EmptyState
                    title="No hubo pedidos a domicilio en este período."
                    className="py-8"
                  />
                ) : (
                  <>
                    <div className="hidden overflow-hidden rounded-xl border border-border md:block">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Zona</TableHead>
                            <TableHead>Pedidos</TableHead>
                            <TableHead>Valor total</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {zones.map((zone) => (
                            <TableRow key={zone.zone_id ?? "sin-zona"}>
                              <TableCell className="font-medium text-foreground">{zone.zone_name}</TableCell>
                              <TableCell className="text-muted-foreground">{zone.orders_count}</TableCell>
                              <TableCell className="text-muted-foreground">
                                {formatCurrencyCents(zone.total_cents)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>

                    <MobileList>
                      {zones.map((zone) => (
                        <MobileListItem
                          key={zone.zone_id ?? "sin-zona"}
                          title={zone.zone_name}
                          subtitle={`${zone.orders_count} pedido${zone.orders_count === 1 ? "" : "s"}`}
                          trailing={
                            <span className="text-sm font-medium text-foreground">
                              {formatCurrencyCents(zone.total_cents)}
                            </span>
                          }
                        />
                      ))}
                    </MobileList>
                  </>
                )}
              </div>

              <p className="mt-3 text-xs text-muted-foreground">
                Tiempo promedio de entrega y rendimiento por repartidor se agregarán más adelante.
              </p>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

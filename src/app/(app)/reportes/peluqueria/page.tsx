import { redirect } from "next/navigation";
import { Scissors, Users, XCircle, UserX } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { getSessionContext } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { resolveReportPeriod } from "@/lib/reportes";
import { formatCurrencyCents } from "@/lib/format";
import { PeriodFilter } from "@/components/reportes/period-filter";
import { businessHasAgenda } from "@/lib/catalog";

interface ProfessionalReportRow {
  professional_id: string;
  professional_name: string;
  appointments_count: number;
  revenue_cents: number;
  commission_cents: number;
}

interface AppointmentFunnelRow {
  pending: number;
  confirmed: number;
  completed: number;
  canceled: number;
  no_show: number;
}

export default async function PeluqueriaReportPage({
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
  if (!businessHasAgenda(session.activeCompany.business_type)) redirect("/reportes");

  const supabase = await createClient();
  const companyId = session.activeCompany.id;
  const timezone = session.activeCompany.timezone;
  const range = resolveReportPeriod(await searchParams, timezone);
  const startDate = range.start.toISOString().slice(0, 10);
  const endDate = range.end.toISOString().slice(0, 10);

  const [{ data: byProfessionalData }, { data: funnelData }] = await Promise.all([
    supabase.rpc("report_appointments_by_professional", {
      p_company_id: companyId,
      p_start: startDate,
      p_end: endDate,
    }),
    supabase.rpc("report_appointment_funnel", {
      p_company_id: companyId,
      p_start: startDate,
      p_end: endDate,
    }),
  ]);

  const byProfessional = (byProfessionalData ?? []) as unknown as ProfessionalReportRow[];
  const funnel = ((funnelData as unknown as AppointmentFunnelRow[] | null)?.[0]) ?? {
    pending: 0,
    confirmed: 0,
    completed: 0,
    canceled: 0,
    no_show: 0,
  };

  const totalAppointments =
    funnel.pending + funnel.confirmed + funnel.completed + funnel.canceled + funnel.no_show;
  const cancellationRate =
    totalAppointments > 0 ? (funnel.canceled / totalAppointments) * 100 : 0;
  const noShowRate = totalAppointments > 0 ? (funnel.no_show / totalAppointments) * 100 : 0;

  const rankedProfessionals = [...byProfessional].sort(
    (a, b) => b.revenue_cents - a.revenue_cents,
  );
  const hasData = totalAppointments > 0;

  return (
    <div>
      <PageHeader
        title="Agenda y comisiones"
        description="Comisiones por profesional y embudo de citas."
      />

      <div className="mb-5">
        <PeriodFilter />
      </div>

      {!hasData ? (
        <EmptyState
          icon={Scissors}
          title="Todavía no hay citas en este período."
          description="Ajusta el período o registra una cita para ver el reporte."
        />
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Citas completadas" value={String(funnel.completed)} icon={Scissors} />
            <StatCard
              label="Tasa de cancelación"
              value={`${cancellationRate.toFixed(1)}%`}
              icon={XCircle}
              hint={`${funnel.canceled} cancelada${funnel.canceled === 1 ? "" : "s"}`}
            />
            <StatCard
              label="Tasa de no-show"
              value={`${noShowRate.toFixed(1)}%`}
              icon={UserX}
              hint={`${funnel.no_show} sin asistir`}
            />
            <StatCard label="Profesionales activos" value={String(byProfessional.length)} icon={Users} />
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-sm font-medium text-foreground">Embudo de citas</p>
            <p className="text-xs text-muted-foreground">
              Estado de todas las citas del período.
            </p>
            <ul className="mt-3 space-y-3">
              {[
                { label: "Pendientes", value: funnel.pending },
                { label: "Confirmadas", value: funnel.confirmed },
                { label: "Completadas", value: funnel.completed },
                { label: "Canceladas", value: funnel.canceled },
                { label: "No asistió", value: funnel.no_show },
              ].map((item) => {
                const pct = totalAppointments > 0 ? (item.value / totalAppointments) * 100 : 0;
                return (
                  <li key={item.label}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-foreground">{item.label}</span>
                      <span className="text-muted-foreground">
                        {item.value} cita{item.value === 1 ? "" : "s"}
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
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-sm font-medium text-foreground">Comisiones por profesional</p>
            <p className="text-xs text-muted-foreground">
              Ingresos generados y comisión a pagar en el período.
            </p>
            {rankedProfessionals.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">
                No hay profesionales registrados.
              </p>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[480px] text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs text-muted-foreground">
                      <th className="pb-2 font-medium">Profesional</th>
                      <th className="pb-2 font-medium">Citas completadas</th>
                      <th className="pb-2 font-medium">Ingresos generados</th>
                      <th className="pb-2 font-medium">Comisión a pagar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rankedProfessionals.map((p) => (
                      <tr key={p.professional_id} className="border-b border-border/60 last:border-0">
                        <td className="py-2 text-foreground">{p.professional_name}</td>
                        <td className="py-2 text-muted-foreground">{p.appointments_count}</td>
                        <td className="py-2 text-foreground">{formatCurrencyCents(p.revenue_cents)}</td>
                        <td className="py-2 font-medium text-foreground">
                          {formatCurrencyCents(p.commission_cents)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import * as React from "react";
import Link from "next/link";
import { CalendarClock, UserCog, Wrench } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { AgendaStatsBar } from "@/components/agenda/agenda-stats-bar";
import { AgendaFiltersBar, type AgendaFilters } from "@/components/agenda/agenda-filters-bar";
import { AppointmentFormSheet } from "@/components/agenda/appointment-form-sheet";
import { DayTimelineView } from "@/components/agenda/day-timeline-view";
import { WeekView } from "@/components/agenda/week-view";
import { MonthView } from "@/components/agenda/month-view";
import { customerFullName } from "@/lib/catalog";
import type { AppointmentRow } from "@/components/agenda/appointment-list";
import type { AgendaView } from "@/lib/agenda-dates";
import type { Customer, Product, Professional, Service } from "@/types/database";

const EMPTY_FILTERS: AgendaFilters = { search: "", professionalId: "all", serviceId: "all", status: "all" };

/**
 * Contenedor cliente de la Agenda — une filtros, estadísticas del día y las
 * tres vistas (día/semana/mes), aplicando los filtros en memoria sobre los
 * datos ya traídos por el servidor (sin re-consultar Supabase por cada
 * cambio de filtro).
 */
export function AgendaBoard({
  view,
  date,
  weekStart,
  appointments,
  dayAppointments,
  customers,
  services,
  professionals,
  products,
  hasOpenCashRegister,
}: {
  view: AgendaView;
  date: string;
  weekStart: string;
  appointments: AppointmentRow[];
  dayAppointments: AppointmentRow[];
  customers: Customer[];
  services: Service[];
  professionals: Professional[];
  products: Product[];
  hasOpenCashRegister: boolean;
}) {
  const [filters, setFilters] = React.useState<AgendaFilters>(EMPTY_FILTERS);

  const filteredAppointments = React.useMemo(() => {
    const search = filters.search.trim().toLowerCase();
    return appointments.filter((a) => {
      if (filters.professionalId !== "all" && a.professional_id !== filters.professionalId) return false;
      if (filters.serviceId !== "all" && a.service_id !== filters.serviceId) return false;
      if (filters.status !== "all" && a.status !== filters.status) return false;
      if (search) {
        const name = a.customers ? customerFullName(a.customers).toLowerCase() : "";
        if (!name.includes(search)) return false;
      }
      return true;
    });
  }, [appointments, filters]);

  const filteredDayAppointments = React.useMemo(
    () => filteredAppointments.filter((a) => a.appointment_date === date),
    [filteredAppointments, date],
  );

  if (professionals.length === 0) {
    return (
      <EmptyState
        icon={UserCog}
        title="No tienes profesionales configurados"
        description="Agrega al menos un profesional para empezar a agendar citas."
        action={
          <Button asChild>
            <Link href="/profesionales">Configurar profesionales</Link>
          </Button>
        }
      />
    );
  }

  if (services.length === 0) {
    return (
      <EmptyState
        icon={Wrench}
        title="No tienes servicios configurados"
        description="Agrega al menos un servicio para poder agendar citas."
        action={
          <Button asChild>
            <Link href="/servicios">Configurar servicios</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <AgendaStatsBar appointments={dayAppointments} />
      <AgendaFiltersBar professionals={professionals} services={services} onFilterChange={setFilters} />

      {view === "day" &&
        (filteredDayAppointments.length > 0 ? (
          <DayTimelineView
            date={date}
            appointments={filteredDayAppointments}
            professionals={professionals}
            customers={customers}
            services={services}
            products={products}
            hasOpenCashRegister={hasOpenCashRegister}
          />
        ) : (
          <EmptyState
            icon={CalendarClock}
            title={appointments.length === 0 ? "Tu agenda está libre" : "Sin citas con estos filtros"}
            description={
              appointments.length === 0
                ? "Agrega una cita para comenzar."
                : "Ajusta los filtros para ver otras citas de este día."
            }
            action={
              <AppointmentFormSheet
                date={date}
                customers={customers}
                services={services}
                professionals={professionals}
              />
            }
          />
        ))}

      {view === "week" && (
        <WeekView
          startDate={weekStart}
          appointments={filteredAppointments}
          professionals={professionals}
          products={products}
          hasOpenCashRegister={hasOpenCashRegister}
        />
      )}
      {view === "month" && <MonthView date={date} appointments={filteredAppointments} />}
    </div>
  );
}

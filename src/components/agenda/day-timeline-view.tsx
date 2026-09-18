"use client";

import * as React from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AppointmentCard } from "@/components/agenda/appointment-card";
import { AppointmentDetailDrawer } from "@/components/agenda/appointment-detail-drawer";
import { AppointmentFormSheet } from "@/components/agenda/appointment-form-sheet";
import { formatAppointmentTime } from "@/lib/agenda-status";
import type { StaffTerms } from "@/lib/staff-terms";
import type { AppointmentRow } from "@/components/agenda/appointment-list";
import type { Customer, Product, Professional, Service } from "@/types/database";

const SLOT_MINUTES = 30;
const UNASSIGNED = "__unassigned__";

const PX_PER_MIN = 2;
const DEFAULT_RANGE_START = 8 * 60;
const DEFAULT_RANGE_END = 20 * 60;
const DEFAULT_DURATION_MINUTES = 30;

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":");
  return Number(h) * 60 + Number(m ?? 0);
}

function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function computeRange(professionals: Professional[]): [number, number] {
  if (professionals.length === 0) return [DEFAULT_RANGE_START, DEFAULT_RANGE_END];
  let min = Infinity;
  let max = -Infinity;
  for (const p of professionals) {
    if (p.work_start_time) min = Math.min(min, timeToMinutes(p.work_start_time));
    if (p.work_end_time) max = Math.max(max, timeToMinutes(p.work_end_time));
  }
  if (!Number.isFinite(min) || !Number.isFinite(max) || min >= max) {
    return [DEFAULT_RANGE_START, DEFAULT_RANGE_END];
  }
  return [Math.floor(min / 60) * 60, Math.ceil(max / 60) * 60];
}

function getAppointmentEndMinutes(
  appointment: AppointmentRow,
  startMinutes: number,
  serviceDurations: Map<string, number>,
): number {
  if (appointment.end_time) return timeToMinutes(appointment.end_time);
  const duration =
    (appointment.service_id ? serviceDurations.get(appointment.service_id) : null) ??
    DEFAULT_DURATION_MINUTES;
  return startMinutes + duration;
}

type LaidOutAppointment = { appointment: AppointmentRow; col: number; cols: number };

function layoutColumn(
  appointments: AppointmentRow[],
  serviceDurations: Map<string, number>,
): LaidOutAppointment[] {
  const sorted = [...appointments].sort(
    (a, b) => timeToMinutes(a.start_time) - timeToMinutes(b.start_time),
  );
  const result: LaidOutAppointment[] = [];
  let cluster: LaidOutAppointment[] = [];
  let active: { end: number; col: number }[] = [];

  function flushCluster() {
    if (cluster.length === 0) return;
    const cols = Math.max(...cluster.map((c) => c.col)) + 1;
    for (const item of cluster) item.cols = cols;
    result.push(...cluster);
    cluster = [];
  }

  for (const appointment of sorted) {
    const start = timeToMinutes(appointment.start_time);
    const end = getAppointmentEndMinutes(appointment, start, serviceDurations);
    active = active.filter((a) => a.end > start);
    if (active.length === 0) flushCluster();
    const usedCols = new Set(active.map((a) => a.col));
    let col = 0;
    while (usedCols.has(col)) col++;
    active.push({ end, col });
    cluster.push({ appointment, col, cols: 1 });
  }
  flushCluster();

  return result;
}

function todayIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function DayTimelineView({
  date,
  appointments,
  professionals,
  allowUnassigned,
  terms,
  customers,
  services,
  products,
  hasOpenCashRegister,
}: {
  date: string;
  appointments: AppointmentRow[];
  professionals: Professional[];
  /** Agrega una columna "Sin asignar" para las citas que no van con nadie. */
  allowUnassigned: boolean;
  terms: StaffTerms;
  customers: Customer[];
  services: Service[];
  products: Product[];
  hasOpenCashRegister: boolean;
}) {
  const [selectedAppointment, setSelectedAppointment] = React.useState<AppointmentRow | null>(null);
  const [detailOpen, setDetailOpen] = React.useState(false);
  const [newAppointmentSlot, setNewAppointmentSlot] = React.useState<{
    time: string;
    professionalId: string;
  } | null>(null);
  const [formOpen, setFormOpen] = React.useState(false);
  const [, forceNowTick] = React.useReducer((c: number) => c + 1, 0);

  const [rangeStart, rangeEnd] = React.useMemo(() => computeRange(professionals), [professionals]);
  const totalMinutes = rangeEnd - rangeStart;

  const slots = React.useMemo(() => {
    const list: number[] = [];
    for (let m = rangeStart; m < rangeEnd; m += SLOT_MINUTES) list.push(m);
    return list;
  }, [rangeStart, rangeEnd]);

  const isToday = date === todayIso();

  React.useEffect(() => {
    if (!isToday) return;
    const id = setInterval(forceNowTick, 60_000);
    return () => clearInterval(id);
  }, [isToday]);

  const nowMinutes = isToday ? (() => {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
  })() : null;

  const serviceDurations = React.useMemo(() => {
    const map = new Map<string, number>();
    for (const service of services) {
      if (service.duration_minutes) map.set(service.id, service.duration_minutes);
    }
    return map;
  }, [services]);

  /**
   * Una columna por persona. En "Varios" se suma "Sin asignar", porque ahí la
   * cita la define el servicio y asignar a alguien es opcional; sin esa
   * columna esas citas no se verían en ningún lado.
   */
  const columns = React.useMemo(() => {
    const base = professionals.map((p) => ({
      id: p.id,
      name: p.name,
      photoUrl: p.photo_url,
      assignable: true,
    }));
    return allowUnassigned
      ? [...base, { id: UNASSIGNED, name: "Sin asignar", photoUrl: null, assignable: false }]
      : base;
  }, [professionals, allowUnassigned]);

  const appointmentsByColumn = React.useMemo(() => {
    const map = new Map<string, AppointmentRow[]>();
    for (const column of columns) map.set(column.id, []);
    for (const appointment of appointments) {
      const key = appointment.professional_id ?? UNASSIGNED;
      const bucket = map.get(key);
      if (bucket) bucket.push(appointment);
    }
    return map;
  }, [appointments, columns]);

  function openDetail(appointment: AppointmentRow) {
    setSelectedAppointment(appointment);
    setDetailOpen(true);
  }

  function openNewAppointment(time: string, professionalId: string) {
    setNewAppointmentSlot({ time, professionalId });
    setFormOpen(true);
  }

  if (columns.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted-foreground">
        Aún no hay profesionales configurados para mostrar la agenda.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card">
      <div className="flex min-w-fit">
        <div className="sticky left-0 z-10 w-16 shrink-0 border-r border-border bg-card">
          <div className="h-14 border-b border-border" />
          <div className="relative" style={{ height: totalMinutes * PX_PER_MIN }}>
            {slots.map((minutes) => (
              <div
                key={minutes}
                className="absolute left-0 w-full pr-2 text-right text-[11px] text-muted-foreground"
                style={{ top: (minutes - rangeStart) * PX_PER_MIN - 6 }}
              >
                {minutes % 60 === 0 ? formatAppointmentTime(minutesToTime(minutes)) : ""}
              </div>
            ))}
          </div>
        </div>

        {columns.map((column) => {
          const laidOut = layoutColumn(
            appointmentsByColumn.get(column.id) ?? [],
            serviceDurations,
          );
          return (
            <div key={column.id} className="w-56 shrink-0 border-r border-border last:border-r-0">
              <div className="flex h-14 items-center gap-2 border-b border-border px-3">
                <Avatar size="sm">
                  {column.photoUrl && <AvatarImage src={column.photoUrl} alt={column.name} />}
                  <AvatarFallback>{column.name.slice(0, 1)}</AvatarFallback>
                </Avatar>
                <span className="truncate text-sm font-medium text-foreground">{column.name}</span>
              </div>

              <div className="relative" style={{ height: totalMinutes * PX_PER_MIN }}>
                {slots.map((minutes) => (
                  <button
                    key={minutes}
                    type="button"
                    onClick={() => openNewAppointment(minutesToTime(minutes), column.assignable ? column.id : "")}
                    className="group absolute left-0 flex w-full items-center justify-center border-b border-border/50 transition-colors hover:bg-accent/40"
                    style={{ top: (minutes - rangeStart) * PX_PER_MIN, height: SLOT_MINUTES * PX_PER_MIN }}
                  >
                    <span className="hidden text-[10px] text-muted-foreground group-hover:inline">
                      Disponible
                    </span>
                  </button>
                ))}

                {isToday && nowMinutes !== null && nowMinutes >= rangeStart && nowMinutes <= rangeEnd && (
                  <div
                    className="pointer-events-none absolute left-0 z-20 w-full border-t-2 border-destructive"
                    style={{ top: (nowMinutes - rangeStart) * PX_PER_MIN }}
                  >
                    <span className="absolute -top-1.5 -left-0.5 size-3 rounded-full bg-destructive" />
                  </div>
                )}

                {laidOut.map(({ appointment, col, cols }) => {
                  const start = timeToMinutes(appointment.start_time);
                  const end = getAppointmentEndMinutes(appointment, start, serviceDurations);
                  const top = Math.max(0, (start - rangeStart) * PX_PER_MIN);
                  const height = Math.max(
                    (SLOT_MINUTES / 2) * PX_PER_MIN,
                    (end - start) * PX_PER_MIN - 2,
                  );
                  const widthPct = 100 / cols;
                  return (
                    <AppointmentCard
                      key={appointment.id}
                      appointment={appointment}
                      compact={height < SLOT_MINUTES * PX_PER_MIN}
                      onClick={() => openDetail(appointment)}
                      className="absolute z-10"
                      style={{
                        top,
                        height,
                        left: `${col * widthPct}%`,
                        width: `calc(${widthPct}% - 4px)`,
                      }}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <AppointmentDetailDrawer
        appointment={selectedAppointment}
        professionals={professionals}
        products={products}
        hasOpenCashRegister={hasOpenCashRegister}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />

      <AppointmentFormSheet
        date={date}
        customers={customers}
        services={services}
        professionals={professionals}
        terms={terms}
        initialStartTime={newAppointmentSlot?.time}
        initialProfessionalId={newAppointmentSlot?.professionalId}
        open={formOpen}
        onOpenChange={setFormOpen}
        trigger={null}
      />
    </div>
  );
}

import Link from "next/link";
import { weekDays, WEEKDAY_LABELS } from "@/lib/agenda-dates";
import { customerFullName } from "@/lib/catalog";
import { cn } from "@/lib/utils";
import type { AppointmentRow } from "@/components/agenda/appointment-list";

export function WeekView({
  startDate,
  appointments,
}: {
  startDate: string;
  appointments: AppointmentRow[];
}) {
  const days = weekDays(startDate);
  const todayIso = new Date().toISOString().slice(0, 10);

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
      {days.map((day, i) => {
        const dayAppointments = appointments
          .filter((a) => a.appointment_date === day)
          .sort((a, b) => a.start_time.localeCompare(b.start_time));
        const isToday = day === todayIso;

        return (
          <div key={day} className="rounded-xl border border-border p-3">
            <Link
              href={`/agenda?date=${day}&view=day`}
              className={cn(
                "mb-2 flex items-baseline justify-between text-sm font-semibold text-foreground hover:underline",
                isToday && "text-primary",
              )}
            >
              <span>{WEEKDAY_LABELS[i]}</span>
              <span>{Number(day.slice(8, 10))}</span>
            </Link>
            {dayAppointments.length === 0 ? (
              <p className="text-xs text-muted-foreground">Sin citas</p>
            ) : (
              <ul className="space-y-1.5">
                {dayAppointments.map((a) => (
                  <li key={a.id} className="rounded-lg bg-muted/50 p-2 text-xs">
                    <p className="font-medium text-foreground">
                      {a.start_time.slice(0, 5)} ·{" "}
                      {a.customers ? customerFullName(a.customers) : "Cliente general"}
                    </p>
                    <p className="text-muted-foreground">
                      {a.services?.name ?? "Sin servicio"} · {a.professionals?.name ?? "Sin profesional"}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}

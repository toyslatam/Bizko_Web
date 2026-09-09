import Link from "next/link";
import { monthGridDays, isSameMonth, WEEKDAY_LABELS } from "@/lib/agenda-dates";
import { APPOINTMENT_STATUS_STYLE } from "@/lib/agenda-status";
import { cn } from "@/lib/utils";
import type { AppointmentRow } from "@/components/agenda/appointment-list";

const MAX_DOTS = 4;

export function MonthView({
  date,
  appointments,
}: {
  date: string;
  appointments: AppointmentRow[];
}) {
  const days = monthGridDays(date);
  const appointmentsByDay = new Map<string, AppointmentRow[]>();
  for (const a of appointments) {
    const list = appointmentsByDay.get(a.appointment_date) ?? [];
    list.push(a);
    appointmentsByDay.set(a.appointment_date, list);
  }
  const todayIso = new Date().toISOString().slice(0, 10);

  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-muted-foreground">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label} className="py-1">
            {label}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {days.map((day) => {
          const dayAppointments = appointmentsByDay.get(day) ?? [];
          const inMonth = isSameMonth(day, date);
          const isToday = day === todayIso;
          const dots = dayAppointments.slice(0, MAX_DOTS);
          const overflow = dayAppointments.length - dots.length;

          return (
            <Link
              key={day}
              href={`/agenda?date=${day}&view=day`}
              className={cn(
                "flex aspect-square flex-col items-center justify-start gap-1.5 rounded-lg border border-transparent p-1.5 pt-2 text-sm transition-colors hover:border-border hover:bg-muted/40",
                !inMonth && "text-muted-foreground/40",
                isToday && "border-primary/50 bg-primary/[0.04] font-semibold text-primary",
              )}
            >
              <span
                className={cn(
                  "flex size-6 items-center justify-center rounded-full",
                  isToday && "bg-primary text-primary-foreground",
                )}
              >
                {Number(day.slice(8, 10))}
              </span>
              {dayAppointments.length > 0 && (
                <div className="flex flex-wrap items-center justify-center gap-0.5">
                  {dots.map((a) => (
                    <span
                      key={a.id}
                      className={cn("size-1.5 rounded-full", APPOINTMENT_STATUS_STYLE[a.status].dot)}
                    />
                  ))}
                  {overflow > 0 && (
                    <span className="text-[9px] leading-none text-muted-foreground">+{overflow}</span>
                  )}
                </div>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

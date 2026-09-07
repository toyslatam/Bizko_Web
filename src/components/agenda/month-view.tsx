import Link from "next/link";
import { monthGridDays, isSameMonth, WEEKDAY_LABELS } from "@/lib/agenda-dates";
import { cn } from "@/lib/utils";
import type { AppointmentRow } from "@/components/agenda/appointment-list";

export function MonthView({
  date,
  appointments,
}: {
  date: string;
  appointments: AppointmentRow[];
}) {
  const days = monthGridDays(date);
  const countByDay = new Map<string, number>();
  for (const a of appointments) {
    countByDay.set(a.appointment_date, (countByDay.get(a.appointment_date) ?? 0) + 1);
  }
  const todayIso = new Date().toISOString().slice(0, 10);

  return (
    <div className="rounded-xl border border-border p-3">
      <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-muted-foreground">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label} className="py-1">
            {label}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((day) => {
          const count = countByDay.get(day) ?? 0;
          const inMonth = isSameMonth(day, date);
          const isToday = day === todayIso;
          return (
            <Link
              key={day}
              href={`/agenda?date=${day}&view=day`}
              className={cn(
                "flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border border-transparent text-sm transition-colors hover:border-border hover:bg-muted/50",
                !inMonth && "text-muted-foreground/40",
                isToday && "border-primary/40 font-semibold text-primary",
              )}
            >
              <span>{Number(day.slice(8, 10))}</span>
              {count > 0 && (
                <span className="flex size-4 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">
                  {count}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

import { cn } from "@/lib/utils";
import type { AppointmentRow } from "@/components/agenda/appointment-list";

export function AgendaStatsBar({ appointments }: { appointments: AppointmentRow[] }) {
  const total = appointments.length;
  const confirmed = appointments.filter((a) => a.status === "confirmed").length;
  const pending = appointments.filter((a) => a.status === "pending").length;
  const completed = appointments.filter((a) => a.status === "completed").length;

  const stats = [
    { label: "Citas de hoy", value: total },
    { label: "Confirmadas", value: confirmed, dot: "bg-sky-500" },
    { label: "Pendientes", value: pending, dot: "bg-amber-500" },
    { label: "Completadas", value: completed, dot: "bg-emerald-500" },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5"
        >
          {stat.dot && <span className={cn("size-1.5 rounded-full", stat.dot)} />}
          <span className="text-sm font-semibold text-foreground">{stat.value}</span>
          <span className="text-xs text-muted-foreground">{stat.label}</span>
        </div>
      ))}
    </div>
  );
}

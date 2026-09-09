import type { AppointmentStatus } from "@/types/database";

/** Sistema visual de estados de una cita — un color de acento + un tono de fondo suave, consistentes en toda la Agenda (grid, tarjetas, drawer). */
export const APPOINTMENT_STATUS_STYLE: Record<
  AppointmentStatus,
  { dot: string; badge: string; border: string }
> = {
  pending: {
    dot: "bg-amber-500",
    badge: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
    border: "border-l-amber-500",
  },
  confirmed: {
    dot: "bg-sky-500",
    badge: "bg-sky-500/10 text-sky-700 dark:text-sky-400",
    border: "border-l-sky-500",
  },
  in_progress: {
    dot: "bg-violet-500",
    badge: "bg-violet-500/10 text-violet-700 dark:text-violet-400",
    border: "border-l-violet-500",
  },
  completed: {
    dot: "bg-emerald-500",
    badge: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
    border: "border-l-emerald-500",
  },
  canceled: {
    dot: "bg-muted-foreground/40",
    badge: "bg-muted text-muted-foreground",
    border: "border-l-muted-foreground/30",
  },
  no_show: {
    dot: "bg-destructive",
    badge: "bg-destructive/10 text-destructive",
    border: "border-l-destructive",
  },
};

/** Próximo estado que avanza el flujo de una cita en un clic ("Confirmar", "Iniciar servicio"). null = ya no avanza (requiere completar/cobrar o ya terminó). */
export const NEXT_STATUS: Partial<Record<AppointmentStatus, { status: AppointmentStatus; label: string }>> = {
  pending: { status: "confirmed", label: "Confirmar" },
  confirmed: { status: "in_progress", label: "Iniciar servicio" },
};

export function formatAppointmentTime(time: string): string {
  const [h, m] = time.split(":");
  const hour = Number(h);
  const period = hour >= 12 ? "p. m." : "a. m.";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour12}:${m} ${period}`;
}

export function formatAppointmentRange(startTime: string, endTime: string | null): string {
  if (!endTime) return formatAppointmentTime(startTime);
  return `${formatAppointmentTime(startTime)} – ${formatAppointmentTime(endTime)}`;
}

"use client";

import { DollarSign } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { customerFullName } from "@/lib/catalog";
import { APPOINTMENT_STATUS_STYLE, formatAppointmentTime } from "@/lib/agenda-status";
import { APPOINTMENT_STATUS_LABELS } from "@/lib/catalog";
import type { AppointmentRow } from "@/components/agenda/appointment-list";

/**
 * Tarjeta de cita compartida entre la vista de día (grid por profesional),
 * semana y lista — un solo lugar que define cómo se ve una cita en toda la
 * Agenda. Solo presentación: el detalle/acciones viven en
 * AppointmentDetailDrawer, que se abre al hacer clic.
 */
export function AppointmentCard({
  appointment,
  onClick,
  compact = false,
  className,
  style,
}: {
  appointment: AppointmentRow;
  onClick?: () => void;
  compact?: boolean;
  className?: string;
  style?: React.CSSProperties;
}) {
  const statusStyle = APPOINTMENT_STATUS_STYLE[appointment.status];

  return (
    <button
      type="button"
      onClick={onClick}
      style={style}
      className={cn(
        "flex w-full flex-col gap-0.5 rounded-lg border border-l-4 border-border bg-card p-2 text-left shadow-xs transition-all hover:shadow-sm hover:brightness-98 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        statusStyle.border,
        compact && "gap-0",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-1.5">
        <span className="text-[11px] font-medium text-muted-foreground">
          {formatAppointmentTime(appointment.start_time)}
        </span>
        <span className={cn("flex items-center gap-1", compact && "hidden")}>
          {appointment.sale_id && <DollarSign className="size-3 text-emerald-600" />}
          <span className={cn("size-1.5 rounded-full", statusStyle.dot)} />
        </span>
      </div>
      <p className="truncate text-xs font-semibold text-foreground">
        {appointment.customers ? customerFullName(appointment.customers) : "Cliente general"}
      </p>
      {!compact && (
        <p className="truncate text-[11px] text-muted-foreground">
          {appointment.services?.name ?? "Sin servicio"}
        </p>
      )}
      {!compact && (
        <Badge className={cn("mt-0.5 w-fit border-0 px-1.5 py-0 text-[10px]", statusStyle.badge)}>
          {APPOINTMENT_STATUS_LABELS[appointment.status]}
        </Badge>
      )}
    </button>
  );
}

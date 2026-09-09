"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarSync, DollarSign, User, XCircle } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { RescheduleDialog } from "@/components/agenda/reschedule-dialog";
import { CompletePaymentDialog } from "@/components/agenda/complete-payment-dialog";
import { setAppointmentStatusAction } from "@/app/(app)/agenda/actions";
import { customerFullName } from "@/lib/catalog";
import { APPOINTMENT_STATUS_LABELS } from "@/lib/catalog";
import { APPOINTMENT_STATUS_STYLE, NEXT_STATUS, formatAppointmentRange } from "@/lib/agenda-status";
import { cn } from "@/lib/utils";
import type { AppointmentRow } from "@/components/agenda/appointment-list";
import type { Product, Professional } from "@/types/database";

/**
 * Panel lateral de detalle de una cita — reemplaza la fila plana de acciones
 * de AppointmentList como forma principal de gestionar una cita desde la
 * grilla/tarjeta. Las acciones disponibles cambian según el estado actual,
 * reutilizando exactamente los mismos diálogos y server actions que ya
 * existían (RescheduleDialog, CompletePaymentDialog, setAppointmentStatusAction).
 */
export function AppointmentDetailDrawer({
  appointment,
  professionals,
  products,
  hasOpenCashRegister,
  open,
  onOpenChange,
  onCreateAnother,
}: {
  appointment: AppointmentRow | null;
  professionals: Professional[];
  products: Product[];
  hasOpenCashRegister: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateAnother?: () => void;
}) {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);
  const [rescheduleOpen, setRescheduleOpen] = React.useState(false);
  const [completeOpen, setCompleteOpen] = React.useState(false);

  if (!appointment) return null;

  const statusStyle = APPOINTMENT_STATUS_STYLE[appointment.status];
  const nextStatus = NEXT_STATUS[appointment.status];
  const canComplete = !appointment.sale_id && appointment.status === "in_progress";
  const canReschedule =
    appointment.status !== "canceled" && appointment.status !== "no_show" && !appointment.sale_id;
  const canCancel = appointment.status === "pending" || appointment.status === "confirmed";

  async function handleAdvanceStatus() {
    if (!nextStatus || !appointment) return;
    setLoading(true);
    const result = await setAppointmentStatusAction(appointment.id, nextStatus.status);
    setLoading(false);
    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    toast.success(`Cita marcada como "${APPOINTMENT_STATUS_LABELS[nextStatus.status]}".`);
    router.refresh();
  }

  async function handleCancel() {
    if (!appointment) return;
    setLoading(true);
    const result = await setAppointmentStatusAction(appointment.id, "canceled");
    setLoading(false);
    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    toast.success("Cita cancelada.");
    router.refresh();
    onOpenChange(false);
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="flex flex-col overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <div className="flex items-center gap-2">
              <span className={cn("size-2 rounded-full", statusStyle.dot)} />
              <SheetTitle>{formatAppointmentRange(appointment.start_time, appointment.end_time)}</SheetTitle>
            </div>
            <SheetDescription>{APPOINTMENT_STATUS_LABELS[appointment.status]}</SheetDescription>
          </SheetHeader>

          <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-4">
            <section className="space-y-2">
              <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Cliente
              </p>
              <div className="flex items-center justify-between gap-2 rounded-xl border border-border bg-card p-3">
                <div className="flex items-center gap-2.5">
                  <Avatar size="sm">
                    <AvatarFallback>
                      {(appointment.customers ? customerFullName(appointment.customers) : "?").slice(0, 1)}
                    </AvatarFallback>
                  </Avatar>
                  <p className="text-sm font-medium text-foreground">
                    {appointment.customers ? customerFullName(appointment.customers) : "Cliente general"}
                  </p>
                </div>
                {appointment.customer_id && (
                  <Button variant="ghost" size="icon-sm" asChild>
                    <Link href={`/clientes/${appointment.customer_id}`}>
                      <User />
                      <span className="sr-only">Ver cliente</span>
                    </Link>
                  </Button>
                )}
              </div>
            </section>

            <section className="space-y-2">
              <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Cita</p>
              <div className="grid grid-cols-2 gap-3 rounded-xl border border-border bg-card p-3 text-sm">
                <InfoField label="Servicio" value={appointment.services?.name ?? "Sin servicio"} />
                <InfoField label="Profesional" value={appointment.professionals?.name ?? "Sin asignar"} />
                <InfoField
                  label="Fecha"
                  value={new Date(`${appointment.appointment_date}T00:00:00`).toLocaleDateString("es-CO", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                />
                <InfoField
                  label="Duración"
                  value={formatAppointmentRange(appointment.start_time, appointment.end_time)}
                />
              </div>
              {appointment.notes && (
                <p className="rounded-lg bg-muted/40 p-2.5 text-xs text-muted-foreground">
                  {appointment.notes}
                </p>
              )}
            </section>

            <section className="space-y-2">
              <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Pago</p>
              <div className="flex items-center justify-between rounded-xl border border-border bg-card p-3 text-sm">
                <span className="text-muted-foreground">Estado del pago</span>
                {appointment.sale_id ? (
                  <Badge className="border-0 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
                    Cobrada
                  </Badge>
                ) : (
                  <Badge variant="outline">Sin cobrar</Badge>
                )}
              </div>
            </section>
          </div>

          <SheetFooter className="flex-row flex-wrap gap-2">
            {appointment.status === "completed" ? (
              <>
                {appointment.sale_id && (
                  <Button variant="outline" asChild className="flex-1">
                    <Link href={`/ventas/${appointment.sale_id}`}>Ver venta</Link>
                  </Button>
                )}
                {appointment.customer_id && (
                  <Button variant="outline" asChild className="flex-1">
                    <Link href={`/clientes/${appointment.customer_id}`}>Ver cliente</Link>
                  </Button>
                )}
                {onCreateAnother && (
                  <Button className="flex-1" onClick={onCreateAnother}>
                    Nueva cita
                  </Button>
                )}
              </>
            ) : (
              <>
                {canCancel && (
                  <Button variant="outline" size="icon" disabled={loading} onClick={handleCancel}>
                    <XCircle />
                    <span className="sr-only">Cancelar</span>
                  </Button>
                )}
                {canReschedule && (
                  <Button
                    variant="outline"
                    disabled={loading}
                    onClick={() => setRescheduleOpen(true)}
                    className="flex-1"
                  >
                    <CalendarSync /> Reprogramar
                  </Button>
                )}
                {canComplete ? (
                  <Button className="flex-1" onClick={() => setCompleteOpen(true)}>
                    <DollarSign /> Completar y cobrar
                  </Button>
                ) : (
                  nextStatus && (
                    <Button className="flex-1" disabled={loading} onClick={handleAdvanceStatus}>
                      {nextStatus.label}
                    </Button>
                  )
                )}
              </>
            )}
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <RescheduleDialog
        key={`reschedule-${appointment.id}`}
        appointment={appointment}
        professionals={professionals}
        open={rescheduleOpen}
        onOpenChange={setRescheduleOpen}
      />

      <CompletePaymentDialog
        key={`complete-${appointment.id}`}
        appointment={appointment}
        products={products}
        hasOpenCashRegister={hasOpenCashRegister}
        open={completeOpen}
        onOpenChange={(next) => {
          setCompleteOpen(next);
          if (!next) router.refresh();
        }}
      />
    </>
  );
}

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="font-medium text-foreground">{value}</p>
    </div>
  );
}

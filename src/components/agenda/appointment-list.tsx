"use client";

import * as React from "react";
import { CalendarSync, DollarSign } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AppointmentStatusSelect } from "@/components/agenda/appointment-status-select";
import { RescheduleDialog } from "@/components/agenda/reschedule-dialog";
import { CompletePaymentDialog } from "@/components/agenda/complete-payment-dialog";
import { customerFullName } from "@/lib/catalog";
import type { Appointment, Customer, Product, Professional, Service } from "@/types/database";

export type AppointmentRow = Appointment & {
  customers: Pick<Customer, "first_name" | "last_name"> | null;
  services: Pick<Service, "name"> | null;
  professionals: Pick<Professional, "name" | "photo_url"> | null;
};

function formatTime(time: string) {
  const [h, m] = time.split(":");
  const hour = Number(h);
  const period = hour >= 12 ? "p. m." : "a. m.";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour12}:${m} ${period}`;
}

export function AppointmentList({
  appointments,
  professionals,
  products,
  hasOpenCashRegister,
}: {
  appointments: AppointmentRow[];
  professionals: Professional[];
  products: Product[];
  hasOpenCashRegister: boolean;
}) {
  const [rescheduleId, setRescheduleId] = React.useState<string | null>(null);
  const [completeId, setCompleteId] = React.useState<string | null>(null);

  const rescheduleTarget = appointments.find((a) => a.id === rescheduleId) ?? null;
  const completeTarget = appointments.find((a) => a.id === completeId) ?? null;

  return (
    <>
      <div className="flex flex-col divide-y divide-border rounded-xl border border-border">
        {appointments.map((a) => {
          const canComplete =
            !a.sale_id && (a.status === "confirmed" || a.status === "in_progress");
          const canReschedule = a.status !== "canceled" && a.status !== "no_show" && !a.sale_id;

          return (
            <div
              key={a.id}
              className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex items-start gap-4">
                <div className="w-20 shrink-0 text-sm font-semibold text-foreground">
                  {formatTime(a.start_time)}
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {a.customers ? customerFullName(a.customers) : "Cliente general"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {a.services?.name ?? "Sin servicio"}
                  </p>
                  <div className="mt-1 flex items-center gap-1.5">
                    <Avatar size="sm">
                      {a.professionals?.photo_url && (
                        <AvatarImage src={a.professionals.photo_url} alt={a.professionals.name} />
                      )}
                      <AvatarFallback>{(a.professionals?.name ?? "?").slice(0, 1)}</AvatarFallback>
                    </Avatar>
                    <span className="text-xs text-muted-foreground">
                      {a.professionals?.name ?? "Sin profesional"}
                    </span>
                    {a.sale_id && (
                      <Badge variant="outline" className="ml-1">
                        Cobrada
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
                {canReschedule && (
                  <Button variant="outline" size="icon-sm" onClick={() => setRescheduleId(a.id)}>
                    <CalendarSync />
                    <span className="sr-only">Reprogramar</span>
                  </Button>
                )}
                {canComplete && (
                  <Button size="sm" onClick={() => setCompleteId(a.id)}>
                    <DollarSign /> Completar y cobrar
                  </Button>
                )}
                <AppointmentStatusSelect appointment={a} onRequestComplete={() => setCompleteId(a.id)} />
              </div>
            </div>
          );
        })}
      </div>

      {rescheduleTarget && (
        <RescheduleDialog
          key={rescheduleTarget.id}
          appointment={rescheduleTarget}
          professionals={professionals}
          open={Boolean(rescheduleTarget)}
          onOpenChange={(next) => !next && setRescheduleId(null)}
        />
      )}

      {completeTarget && (
        <CompletePaymentDialog
          key={completeTarget.id}
          appointment={completeTarget}
          products={products}
          hasOpenCashRegister={hasOpenCashRegister}
          open={Boolean(completeTarget)}
          onOpenChange={(next) => !next && setCompleteId(null)}
        />
      )}
    </>
  );
}

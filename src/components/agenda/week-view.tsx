"use client";

import * as React from "react";
import Link from "next/link";
import { weekDays, WEEKDAY_LABELS } from "@/lib/agenda-dates";
import { cn } from "@/lib/utils";
import { AppointmentCard } from "@/components/agenda/appointment-card";
import { AppointmentDetailDrawer } from "@/components/agenda/appointment-detail-drawer";
import type { AppointmentRow } from "@/components/agenda/appointment-list";
import type { Product, Professional } from "@/types/database";

export function WeekView({
  startDate,
  appointments,
  professionals,
  products,
  hasOpenCashRegister,
}: {
  startDate: string;
  appointments: AppointmentRow[];
  professionals: Professional[];
  products: Product[];
  hasOpenCashRegister: boolean;
}) {
  const days = weekDays(startDate);
  const todayIso = new Date().toISOString().slice(0, 10);
  const [selected, setSelected] = React.useState<AppointmentRow | null>(null);

  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        {days.map((day, i) => {
          const dayAppointments = appointments
            .filter((a) => a.appointment_date === day)
            .sort((a, b) => a.start_time.localeCompare(b.start_time));
          const isToday = day === todayIso;

          return (
            <div
              key={day}
              className={cn(
                "flex flex-col gap-2 rounded-xl border border-border bg-card p-2.5",
                isToday && "border-primary/40 bg-primary/[0.03]",
              )}
            >
              <Link
                href={`/agenda?date=${day}&view=day`}
                className="flex items-center justify-between gap-1.5 rounded-md px-0.5 py-0.5 hover:underline"
              >
                <span
                  className={cn(
                    "text-xs font-medium text-muted-foreground",
                    isToday && "text-primary",
                  )}
                >
                  {WEEKDAY_LABELS[i]}
                </span>
                <span
                  className={cn(
                    "flex size-6 items-center justify-center rounded-full text-sm font-semibold text-foreground",
                    isToday && "bg-primary text-primary-foreground",
                  )}
                >
                  {Number(day.slice(8, 10))}
                </span>
              </Link>

              {dayAppointments.length === 0 ? (
                <p className="px-0.5 text-xs text-muted-foreground">Sin citas</p>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {dayAppointments.map((a) => (
                    <AppointmentCard
                      key={a.id}
                      appointment={a}
                      compact
                      onClick={() => setSelected(a)}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <AppointmentDetailDrawer
        appointment={selected}
        professionals={professionals}
        products={products}
        hasOpenCashRegister={hasOpenCashRegister}
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      />
    </>
  );
}

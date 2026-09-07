"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
  SheetTrigger,
} from "@/components/ui/sheet";
import { CustomerCombobox } from "@/components/ventas/customer-combobox";
import { createAppointmentAction, type AppointmentInput } from "@/app/(app)/agenda/actions";
import type { Customer, Professional, Service } from "@/types/database";

export function AppointmentFormSheet({
  date,
  customers,
  services,
  professionals,
}: {
  date: string;
  customers: Customer[];
  services: Service[];
  professionals: Professional[];
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const emptyValues = React.useMemo<AppointmentInput>(
    () => ({
      appointmentDate: date,
      startTime: "",
      customerId: "",
      serviceId: "",
      professionalId: "",
      notes: "",
    }),
    [date],
  );
  const [values, setValues] = React.useState<AppointmentInput>(emptyValues);
  const [errors, setErrors] = React.useState<Partial<Record<keyof AppointmentInput, string>>>({});
  const [saving, setSaving] = React.useState(false);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setValues(emptyValues);
      setErrors({});
    }
  }

  function patch<K extends keyof AppointmentInput>(key: K, value: AppointmentInput[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErrors({});

    const result = await createAppointmentAction(values);
    setSaving(false);

    if ("error" in result) {
      setErrors(result.fieldErrors ?? {});
      toast.error(result.error);
      return;
    }

    toast.success("Cita creada correctamente.");
    handleOpenChange(false);
    router.refresh();
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetTrigger asChild>
        <Button>
          <CalendarPlus /> Nueva cita
        </Button>
      </SheetTrigger>
      <SheetContent className="overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Nueva cita</SheetTitle>
          <SheetDescription>Agenda una cita para tu negocio.</SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col gap-5 overflow-y-auto px-4">
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="appointmentDate">Fecha</Label>
                <Input
                  id="appointmentDate"
                  type="date"
                  value={values.appointmentDate}
                  onChange={(e) => patch("appointmentDate", e.target.value)}
                  aria-invalid={Boolean(errors.appointmentDate)}
                />
                {errors.appointmentDate && (
                  <p className="text-xs text-destructive">{errors.appointmentDate}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="startTime">Hora inicio</Label>
                <Input
                  id="startTime"
                  type="time"
                  value={values.startTime}
                  onChange={(e) => patch("startTime", e.target.value)}
                  aria-invalid={Boolean(errors.startTime)}
                />
                {errors.startTime && (
                  <p className="text-xs text-destructive">{errors.startTime}</p>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Cliente</Label>
              <CustomerCombobox
                customers={customers}
                value={values.customerId}
                onChange={(v) => patch("customerId", v)}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Servicio</Label>
              <Select
                value={values.serviceId || "none"}
                onValueChange={(v) => patch("serviceId", v === "none" ? "" : v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecciona un servicio" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin servicio</SelectItem>
                  {services.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Profesional</Label>
              <Select
                value={values.professionalId || "none"}
                onValueChange={(v) => patch("professionalId", v === "none" ? "" : v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecciona un profesional" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin asignar</SelectItem>
                  {professionals.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="notes">Notas</Label>
              <Textarea
                id="notes"
                rows={3}
                value={values.notes}
                onChange={(e) => patch("notes", e.target.value)}
                placeholder="Detalles de la cita..."
              />
            </div>
          </div>
        </form>

        <SheetFooter>
          <Button type="submit" onClick={handleSubmit} disabled={saving}>
            {saving ? "Guardando..." : "Crear cita"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

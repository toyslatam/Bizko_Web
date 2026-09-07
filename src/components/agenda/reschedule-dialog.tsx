"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { rescheduleAppointmentAction } from "@/app/(app)/agenda/actions";
import type { Appointment, Professional } from "@/types/database";

export function RescheduleDialog({
  appointment,
  professionals,
  open,
  onOpenChange,
}: {
  appointment: Appointment;
  professionals: Professional[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [appointmentDate, setAppointmentDate] = React.useState(appointment.appointment_date);
  const [startTime, setStartTime] = React.useState(appointment.start_time.slice(0, 5));
  const [professionalId, setProfessionalId] = React.useState(appointment.professional_id ?? "");
  const [saving, setSaving] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const result = await rescheduleAppointmentAction({
      appointmentId: appointment.id,
      appointmentDate,
      startTime,
      professionalId,
    });
    setSaving(false);

    if ("error" in result) {
      toast.error(result.error);
      return;
    }

    toast.success("Cita reprogramada correctamente.");
    onOpenChange(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reprogramar cita</DialogTitle>
          <DialogDescription>Cambia la fecha, hora o profesional de esta cita.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="reschedule-date">Fecha</Label>
              <Input
                id="reschedule-date"
                type="date"
                value={appointmentDate}
                onChange={(e) => setAppointmentDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reschedule-time">Hora</Label>
              <Input
                id="reschedule-time"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Profesional</Label>
            <Select
              value={professionalId || "none"}
              onValueChange={(v) => setProfessionalId(v === "none" ? "" : v)}
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

          <DialogFooter>
            <Button type="submit" disabled={saving}>
              {saving ? "Guardando..." : "Reprogramar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

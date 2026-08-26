"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { setAppointmentStatusAction } from "@/app/(app)/agenda/actions";
import { APPOINTMENT_STATUS_LABELS } from "@/lib/catalog";
import type { Appointment, AppointmentStatus } from "@/types/database";

const STATUS_OPTIONS = Object.keys(APPOINTMENT_STATUS_LABELS) as AppointmentStatus[];

export function AppointmentStatusSelect({ appointment }: { appointment: Appointment }) {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);

  async function handleChange(value: string) {
    const status = value as AppointmentStatus;
    setLoading(true);
    const result = await setAppointmentStatusAction(appointment.id, status);
    setLoading(false);

    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    toast.success(`Cita marcada como "${APPOINTMENT_STATUS_LABELS[status]}".`);
    router.refresh();
  }

  return (
    <Select value={appointment.status} onValueChange={handleChange} disabled={loading}>
      <SelectTrigger className="w-40" size="sm">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {STATUS_OPTIONS.map((status) => (
          <SelectItem key={status} value={status}>
            {APPOINTMENT_STATUS_LABELS[status]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

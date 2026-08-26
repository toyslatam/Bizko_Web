"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { assignDriverAction } from "@/app/(app)/delivery/actions";
import type { DeliveryDriver } from "@/types/database";

const UNASSIGNED = "unassigned";

export function AssignDriverSelect({
  orderId,
  driverId,
  drivers,
}: {
  orderId: string;
  driverId: string | null;
  drivers: DeliveryDriver[];
}) {
  const router = useRouter();

  async function handleChange(value: string) {
    const result = await assignDriverAction(orderId, value === UNASSIGNED ? null : value);
    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    toast.success("Repartidor asignado.");
    router.refresh();
  }

  return (
    <Select value={driverId ?? UNASSIGNED} onValueChange={handleChange}>
      <SelectTrigger className="w-full sm:w-56">
        <SelectValue placeholder="Sin asignar" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={UNASSIGNED}>Sin asignar</SelectItem>
        {drivers.map((d) => (
          <SelectItem key={d.id} value={d.id}>
            {d.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

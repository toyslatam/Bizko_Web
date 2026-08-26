"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Phone } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DriverFormDialog } from "@/components/delivery/driver-form-dialog";
import { setDriverStatusAction } from "@/app/(app)/delivery/actions";
import { DRIVER_STATUS_LABELS } from "@/lib/delivery";
import type { DeliveryDriver, DeliveryDriverStatus } from "@/types/database";

export function DriverList({ drivers }: { drivers: DeliveryDriver[] }) {
  const router = useRouter();

  async function handleStatusChange(id: string, status: DeliveryDriverStatus) {
    const result = await setDriverStatusAction(id, status);
    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="divide-y divide-border rounded-xl border border-border bg-card">
      {drivers.map((driver) => (
        <div key={driver.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
          <div className="min-w-0 flex-1 basis-40">
            <p className="text-sm font-medium text-foreground">{driver.name}</p>
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              <Phone className="size-3" /> {driver.phone}
            </p>
          </div>
          <Select value={driver.status} onValueChange={(v) => handleStatusChange(driver.id, v as DeliveryDriverStatus)}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(DRIVER_STATUS_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DriverFormDialog driver={driver} />
        </div>
      ))}
    </div>
  );
}

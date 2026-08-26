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
import { setLaundryOrderStatusAction } from "@/app/(app)/lavanderia/actions";
import { LAUNDRY_ORDER_STATUS_LABELS } from "@/lib/catalog";
import type { LaundryOrder, LaundryOrderStatus } from "@/types/database";

const STATUSES = Object.keys(LAUNDRY_ORDER_STATUS_LABELS) as LaundryOrderStatus[];

export function LaundryOrderStatusSelect({ order }: { order: LaundryOrder }) {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);

  async function handleChange(value: string) {
    const status = value as LaundryOrderStatus;
    setLoading(true);
    const result = await setLaundryOrderStatusAction(order.id, status);
    setLoading(false);

    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    toast.success(`Orden marcada como "${LAUNDRY_ORDER_STATUS_LABELS[status]}".`);
    router.refresh();
  }

  return (
    <Select value={order.status} onValueChange={handleChange} disabled={loading}>
      <SelectTrigger className="w-44">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {STATUSES.map((status) => (
          <SelectItem key={status} value={status}>
            {LAUNDRY_ORDER_STATUS_LABELS[status]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

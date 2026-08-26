"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { setOrderStatusAction } from "@/app/(app)/pedidos/actions";
import type { Order } from "@/types/database";

/** Para pedidos ya entregados que quedaron con el pago pendiente. */
export function MarkPaidButton({ order }: { order: Order }) {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);

  async function handleClick() {
    setLoading(true);
    const result = await setOrderStatusAction(order.id, order.status, true);
    setLoading(false);

    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    toast.success("Pedido marcado como pagado.");
    router.refresh();
  }

  return (
    <Button variant="outline" disabled={loading} onClick={handleClick}>
      <DollarSign /> Marcar como pagado
    </Button>
  );
}

"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { setOrderStatusAction } from "@/app/(app)/pedidos/actions";
import { ORDER_STATUS_LABELS, nextOrderStatus, canCancelOrder } from "@/lib/orders";
import type { Order } from "@/types/database";

export function OrderStatusActions({ order }: { order: Order }) {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);
  const [cancelOpen, setCancelOpen] = React.useState(false);
  const [paidDialogOpen, setPaidDialogOpen] = React.useState(false);

  const next = nextOrderStatus(order.status, order.fulfillment);

  async function applyStatus(status: typeof order.status, paymentReceived = false) {
    setLoading(true);
    const result = await setOrderStatusAction(order.id, status, paymentReceived);
    setLoading(false);

    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    toast.success(`Pedido marcado como "${ORDER_STATUS_LABELS[status]}".`);
    router.refresh();
  }

  function handleAdvance() {
    if (!next) return;
    if (next === "delivered" && order.payment_method === "cash_on_delivery") {
      setPaidDialogOpen(true);
      return;
    }
    applyStatus(next);
  }

  if (order.status === "canceled" || order.status === "delivered") {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {next && (
        <Button disabled={loading} onClick={handleAdvance}>
          <Check /> Marcar {ORDER_STATUS_LABELS[next].toLowerCase()}
        </Button>
      )}
      {canCancelOrder(order.status) && (
        <Button variant="outline" disabled={loading} onClick={() => setCancelOpen(true)}>
          <X /> Cancelar pedido
        </Button>
      )}

      <ConfirmationDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title="¿Cancelar este pedido?"
        description="El pedido quedará marcado como cancelado. No se elimina, queda en el historial."
        confirmLabel="Cancelar pedido"
        destructive
        loading={loading}
        onConfirm={() => {
          applyStatus("canceled");
          setCancelOpen(false);
        }}
      />

      <Dialog open={paidDialogOpen} onOpenChange={setPaidDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿El cliente realizó el pago?</DialogTitle>
            <DialogDescription>
              Este pedido es contra entrega. Confirma si ya recibiste el dinero.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={loading}
              onClick={() => {
                applyStatus("delivered", false);
                setPaidDialogOpen(false);
              }}
            >
              No, pendiente
            </Button>
            <Button
              disabled={loading}
              onClick={() => {
                applyStatus("delivered", true);
                setPaidDialogOpen(false);
              }}
            >
              Sí, pagó
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

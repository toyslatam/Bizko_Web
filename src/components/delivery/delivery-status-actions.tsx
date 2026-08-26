"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { setDeliveryStatusAction } from "@/app/(app)/delivery/actions";
import { DELIVERY_STATUS_LABELS, DELIVERY_FAILURE_REASONS, nextDeliveryStatus } from "@/lib/delivery";
import type { DeliveryStatus, Order } from "@/types/database";

export function DeliveryStatusActions({ order }: { order: Order }) {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);
  const [paidDialogOpen, setPaidDialogOpen] = React.useState(false);
  const [failDialogOpen, setFailDialogOpen] = React.useState(false);
  const [failureReason, setFailureReason] = React.useState<string>(DELIVERY_FAILURE_REASONS[0]);

  const next = nextDeliveryStatus(order.delivery_status);

  async function apply(status: DeliveryStatus, opts: { failureReason?: string; paymentReceived?: boolean } = {}) {
    setLoading(true);
    const result = await setDeliveryStatusAction(
      order.id,
      status,
      opts.failureReason ?? "",
      opts.paymentReceived ?? false,
    );
    setLoading(false);

    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    toast.success(`Entrega marcada como "${DELIVERY_STATUS_LABELS[status]}".`);
    router.refresh();
  }

  function handleAdvance() {
    if (!next) return;
    if (next === "delivered") {
      setPaidDialogOpen(true);
      return;
    }
    apply(next);
  }

  if (order.delivery_status === "delivered" || order.delivery_status === "failed") {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {next && (
        <Button disabled={loading || !order.delivery_driver_id} onClick={handleAdvance}>
          <Check /> Marcar {DELIVERY_STATUS_LABELS[next].toLowerCase()}
        </Button>
      )}
      <Button variant="outline" disabled={loading} onClick={() => setFailDialogOpen(true)}>
        <AlertTriangle /> Entrega fallida
      </Button>
      {!order.delivery_driver_id && (
        <p className="basis-full text-xs text-muted-foreground">Asigna un repartidor para avanzar.</p>
      )}

      <Dialog open={paidDialogOpen} onOpenChange={setPaidDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿El cliente realizó el pago?</DialogTitle>
            <DialogDescription>
              Este pedido es contra entrega. Confirma si el repartidor ya recibió el dinero.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={loading}
              onClick={() => {
                apply("delivered", { paymentReceived: false });
                setPaidDialogOpen(false);
              }}
            >
              No, pendiente
            </Button>
            <Button
              disabled={loading}
              onClick={() => {
                apply("delivered", { paymentReceived: true });
                setPaidDialogOpen(false);
              }}
            >
              Sí, pagó
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={failDialogOpen} onOpenChange={setFailDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Por qué falló la entrega?</DialogTitle>
            <DialogDescription>El pedido no se elimina, queda marcado como fallido en el historial.</DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Label>Motivo</Label>
            <Select value={failureReason} onValueChange={setFailureReason}>
              <SelectTrigger className="mt-1.5 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DELIVERY_FAILURE_REASONS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setFailDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={loading}
              onClick={() => {
                apply("failed", { failureReason });
                setFailDialogOpen(false);
              }}
            >
              Marcar como fallida
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

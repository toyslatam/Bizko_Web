"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2, CheckCircle2 } from "lucide-react";
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
import { ProductCombobox } from "@/components/inventario/product-combobox";
import { completeAndPayAppointmentAction } from "@/app/(app)/agenda/actions";
import { PAYMENT_METHOD_LABELS } from "@/lib/sales";
import { formatCurrencyCents } from "@/lib/format";
import type { Appointment, PaymentMethod, Product } from "@/types/database";

interface ExtraItemRow {
  key: string;
  productId: string;
  quantity: number;
}

export function CompletePaymentDialog({
  appointment,
  products,
  hasOpenCashRegister,
  open,
  onOpenChange,
}: {
  appointment: Appointment;
  products: Product[];
  hasOpenCashRegister: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [paymentMethod, setPaymentMethod] = React.useState<PaymentMethod>("cash");
  const [extraItems, setExtraItems] = React.useState<ExtraItemRow[]>([]);
  const [saving, setSaving] = React.useState(false);
  const [result, setResult] = React.useState<{ saleId: string; totalCents: number } | null>(null);

  function addExtraItem() {
    setExtraItems((rows) => [...rows, { key: crypto.randomUUID(), productId: "", quantity: 1 }]);
  }

  function updateExtraItem(key: string, patch: Partial<ExtraItemRow>) {
    setExtraItems((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function removeExtraItem(key: string) {
    setExtraItems((rows) => rows.filter((r) => r.key !== key));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    const validItems = extraItems.filter((r) => r.productId && r.quantity > 0);
    const actionResult = await completeAndPayAppointmentAction({
      appointmentId: appointment.id,
      paymentMethod,
      extraItems: validItems.map((r) => ({ productId: r.productId, quantity: r.quantity })),
    });
    setSaving(false);

    if ("error" in actionResult) {
      toast.error(actionResult.error);
      return;
    }

    setResult({ saleId: actionResult.saleId, totalCents: actionResult.totalCents });
    toast.success("Cita completada y venta generada.");
    router.refresh();
  }

  function handleClose(next: boolean) {
    onOpenChange(next);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Completar y cobrar</DialogTitle>
          <DialogDescription>
            Marca la cita como completada y genera la venta correspondiente.
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <CheckCircle2 className="size-10 text-primary" />
            <p className="text-sm font-medium text-foreground">
              Venta generada por {formatCurrencyCents(result.totalCents)}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => handleClose(false)}>
                Cerrar
              </Button>
              <Button asChild>
                <Link href={`/ventas/${result.saleId}`}>Ver venta</Link>
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {!hasOpenCashRegister && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">
                No tienes una caja abierta — la venta se generará, pero no se registrará el
                movimiento de efectivo.
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Método de pago</Label>
              <Select value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as PaymentMethod)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Productos adicionales</Label>
                <Button type="button" variant="outline" size="sm" onClick={addExtraItem}>
                  <Plus /> Agregar producto
                </Button>
              </div>

              {extraItems.map((row) => (
                <div key={row.key} className="flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <ProductCombobox
                      products={products}
                      value={row.productId}
                      onChange={(v) => updateExtraItem(row.key, { productId: v })}
                    />
                  </div>
                  <Input
                    type="number"
                    min={1}
                    step={1}
                    value={row.quantity}
                    onChange={(e) =>
                      updateExtraItem(row.key, { quantity: Number(e.target.value) || 1 })
                    }
                    className="w-20"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeExtraItem(row.key)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
            </div>

            <DialogFooter>
              <Button type="submit" disabled={saving}>
                {saving ? "Procesando..." : "Completar y cobrar"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { closeCashRegisterAction } from "@/app/(app)/caja/actions";
import { formatCurrencyCents } from "@/lib/format";

export function CloseRegisterDialog({
  cashRegisterId,
  expectedCashCents,
}: {
  cashRegisterId: string;
  expectedCashCents: number;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [counted, setCounted] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const countedCents = counted !== "" ? Math.round(Number(counted.replace(",", ".")) * 100) : null;
  const difference = countedCents !== null ? countedCents - expectedCashCents : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (countedCents === null || Number.isNaN(countedCents) || countedCents < 0) {
      toast.error("Ingresa el monto contado.");
      return;
    }

    setSaving(true);
    const result = await closeCashRegisterAction({
      cashRegisterId,
      countedAmountCents: countedCents,
      notes,
    });
    setSaving(false);

    if ("error" in result) {
      toast.error("No pudimos cerrar la caja", { description: result.error });
      return;
    }

    toast.success("Caja cerrada correctamente.");
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="lg" className="h-11">
          <Lock /> Cerrar caja
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Cerrar caja</DialogTitle>
            <DialogDescription>
              Cuenta el efectivo físico que tienes y compáralo con lo esperado.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="flex items-center justify-between rounded-lg bg-muted px-3 py-2.5 text-sm">
              <span className="text-muted-foreground">Efectivo esperado</span>
              <span className="font-medium text-foreground">{formatCurrencyCents(expectedCashCents)}</span>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="countedAmount">Efectivo contado</Label>
              <Input
                id="countedAmount"
                inputMode="decimal"
                autoFocus
                value={counted}
                onChange={(e) => setCounted(e.target.value)}
                placeholder="0"
              />
            </div>

            {difference !== null && !Number.isNaN(difference) && (
              <div
                className={`flex items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium ${
                  difference === 0
                    ? "bg-success/10 text-success"
                    : difference > 0
                      ? "bg-warning/15 text-warning-foreground"
                      : "bg-destructive/10 text-destructive"
                }`}
              >
                <span>Diferencia</span>
                <span>
                  {difference > 0 ? "+" : ""}
                  {formatCurrencyCents(difference)}
                </span>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="closingNotes">Notas (opcional)</Label>
              <Textarea
                id="closingNotes"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Cerrando..." : "Confirmar cierre"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

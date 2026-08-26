"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Wallet } from "lucide-react";
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
import { openCashRegisterAction } from "@/app/(app)/caja/actions";

export function OpenRegisterDialog() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [amount, setAmount] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const n = Number(amount.replace(",", "."));
    if (Number.isNaN(n) || n < 0) {
      toast.error("Ingresa un monto inicial válido.");
      return;
    }

    setSaving(true);
    const result = await openCashRegisterAction({
      openingAmountCents: Math.round(n * 100),
      notes,
    });
    setSaving(false);

    if ("error" in result) {
      toast.error("No pudimos abrir la caja", { description: result.error });
      return;
    }

    toast.success("Tu caja está abierta");
    setOpen(false);
    setAmount("");
    setNotes("");
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="lg" className="h-11">
          <Wallet /> Abrir caja
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Abrir caja</DialogTitle>
            <DialogDescription>
              Registra con cuánto dinero en efectivo empiezas el día.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
              <Label htmlFor="openingAmount">Monto inicial</Label>
              <Input
                id="openingAmount"
                inputMode="decimal"
                autoFocus
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="openingNotes">Notas (opcional)</Label>
              <Textarea
                id="openingNotes"
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
              {saving ? "Abriendo..." : "Abrir caja"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

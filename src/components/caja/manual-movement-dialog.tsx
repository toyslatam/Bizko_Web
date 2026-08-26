"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowDownCircle, ArrowUpCircle } from "lucide-react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { createManualMovementAction } from "@/app/(app)/caja/actions";
import { MANUAL_INCOME_REASONS, MANUAL_EXPENSE_REASONS } from "@/lib/cash";
import { PAYMENT_METHOD_LABELS } from "@/lib/sales";
import type { PaymentMethod } from "@/types/database";

export function ManualMovementDialog({ cashRegisterId }: { cashRegisterId: string }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [type, setType] = React.useState<"income" | "expense">("income");
  const [amount, setAmount] = React.useState("");
  const [paymentMethod, setPaymentMethod] = React.useState<PaymentMethod>("cash");
  const [description, setDescription] = React.useState<string>(MANUAL_INCOME_REASONS[0]);
  const [saving, setSaving] = React.useState(false);

  const reasons = type === "income" ? MANUAL_INCOME_REASONS : MANUAL_EXPENSE_REASONS;

  function handleTypeChange(next: "income" | "expense") {
    setType(next);
    setDescription(next === "income" ? MANUAL_INCOME_REASONS[0] : MANUAL_EXPENSE_REASONS[0]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const n = Number(amount.replace(",", "."));
    if (Number.isNaN(n) || n <= 0) {
      toast.error("Ingresa un monto válido.");
      return;
    }

    setSaving(true);
    const result = await createManualMovementAction({
      cashRegisterId,
      movementType: type,
      amountCents: Math.round(n * 100),
      paymentMethod,
      description,
    });
    setSaving(false);

    if ("error" in result) {
      toast.error("No pudimos registrar el movimiento", { description: result.error });
      return;
    }

    toast.success(type === "income" ? "Ingreso registrado." : "Egreso registrado.");
    setOpen(false);
    setAmount("");
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <ArrowDownCircle /> Registrar movimiento
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Registrar movimiento</DialogTitle>
            <DialogDescription>Dinero que entra o sale de la caja sin ser una venta.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleTypeChange("income")}
                className={`flex items-center justify-center gap-1.5 rounded-lg border py-2 text-sm font-medium transition-colors ${
                  type === "income"
                    ? "border-success bg-success/10 text-success"
                    : "border-border text-muted-foreground hover:bg-muted"
                }`}
              >
                <ArrowUpCircle className="size-4" /> Ingreso
              </button>
              <button
                type="button"
                onClick={() => handleTypeChange("expense")}
                className={`flex items-center justify-center gap-1.5 rounded-lg border py-2 text-sm font-medium transition-colors ${
                  type === "expense"
                    ? "border-destructive bg-destructive/10 text-destructive"
                    : "border-border text-muted-foreground hover:bg-muted"
                }`}
              >
                <ArrowDownCircle className="size-4" /> Egreso
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="movementAmount">Monto</Label>
                <Input
                  id="movementAmount"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Método</Label>
                <Select value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as PaymentMethod)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(["cash", "transfer", "card"] as PaymentMethod[]).map((m) => (
                      <SelectItem key={m} value={m}>
                        {PAYMENT_METHOD_LABELS[m]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Motivo</Label>
              <Select value={description} onValueChange={setDescription}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {reasons.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Guardando..." : "Registrar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

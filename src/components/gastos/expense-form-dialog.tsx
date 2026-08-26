"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { createExpenseAction, type ExpenseInput } from "@/app/(app)/gastos/actions";
import { PAYMENT_METHOD_LABELS } from "@/lib/sales";
import type { ExpenseCategory, PaymentMethod } from "@/types/database";

const EMPTY: ExpenseInput = {
  categoryId: null,
  description: "",
  amount: "",
  paymentMethod: "cash",
  date: new Date().toISOString().slice(0, 10),
  notes: "",
};

export function ExpenseFormDialog({ categories }: { categories: ExpenseCategory[] }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [values, setValues] = React.useState<ExpenseInput>(EMPTY);
  const [errors, setErrors] = React.useState<Partial<Record<"description" | "amount", string>>>({});
  const [saving, setSaving] = React.useState(false);

  function patch<K extends keyof ExpenseInput>(key: K, value: ExpenseInput[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErrors({});

    const result = await createExpenseAction(values);
    setSaving(false);

    if ("error" in result) {
      setErrors(result.fieldErrors ?? {});
      toast.error(result.error);
      return;
    }

    toast.success("Gasto registrado correctamente.");
    setOpen(false);
    setValues({ ...EMPTY, date: new Date().toISOString().slice(0, 10) });
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Receipt /> Nuevo gasto
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Nuevo gasto</DialogTitle>
            <DialogDescription>Registra un gasto de tu negocio.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
              <Label htmlFor="expenseDescription">Descripción</Label>
              <Input
                id="expenseDescription"
                autoFocus
                value={values.description}
                onChange={(e) => patch("description", e.target.value)}
                placeholder="Compra de insumos"
                aria-invalid={Boolean(errors.description)}
              />
              {errors.description && <p className="text-xs text-destructive">{errors.description}</p>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="expenseAmount">Monto</Label>
                <Input
                  id="expenseAmount"
                  inputMode="decimal"
                  value={values.amount}
                  onChange={(e) => patch("amount", e.target.value)}
                  placeholder="0"
                  aria-invalid={Boolean(errors.amount)}
                />
                {errors.amount && <p className="text-xs text-destructive">{errors.amount}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="expenseDate">Fecha</Label>
                <Input
                  id="expenseDate"
                  type="date"
                  value={values.date}
                  onChange={(e) => patch("date", e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Método de pago</Label>
                <Select
                  value={values.paymentMethod}
                  onValueChange={(v) => patch("paymentMethod", v as PaymentMethod)}
                >
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
              <div className="space-y-1.5">
                <Label>Categoría</Label>
                <Select
                  value={values.categoryId ?? "none"}
                  onValueChange={(v) => patch("categoryId", v === "none" ? null : v)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Sin categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin categoría</SelectItem>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="expenseNotes">Notas (opcional)</Label>
              <Textarea
                id="expenseNotes"
                rows={2}
                value={values.notes}
                onChange={(e) => patch("notes", e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Guardando..." : "Registrar gasto"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

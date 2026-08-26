"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Shirt, X } from "lucide-react";
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
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
  SheetTrigger,
} from "@/components/ui/sheet";
import { CustomerCombobox } from "@/components/ventas/customer-combobox";
import {
  createLaundryOrderAction,
  type LaundryOrderInput,
  type LaundryOrderItemInput,
} from "@/app/(app)/lavanderia/actions";
import type { Customer, Service } from "@/types/database";

const EMPTY_ITEM: LaundryOrderItemInput = { serviceId: null, description: "", quantity: 1 };

const EMPTY: LaundryOrderInput = {
  customerId: null,
  estimatedReadyAt: null,
  notes: "",
  items: [{ ...EMPTY_ITEM }],
};

export function LaundryOrderFormSheet({
  customers,
  services,
}: {
  customers: Customer[];
  services: Service[];
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [values, setValues] = React.useState<LaundryOrderInput>(EMPTY);
  const [saving, setSaving] = React.useState(false);

  function patchItem(index: number, patch: Partial<LaundryOrderItemInput>) {
    setValues((v) => ({
      ...v,
      items: v.items.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    }));
  }

  function addItem() {
    setValues((v) => ({ ...v, items: [...v.items, { ...EMPTY_ITEM }] }));
  }

  function removeItem(index: number) {
    setValues((v) => ({ ...v, items: v.items.filter((_, i) => i !== index) }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    const result = await createLaundryOrderAction({
      ...values,
      items: values.items
        .filter((item) => item.description.trim())
        .map((item) => ({ ...item, description: item.description.trim() })),
    });
    setSaving(false);

    if ("error" in result) {
      toast.error(result.error);
      return;
    }

    toast.success("Orden de lavado creada correctamente.");
    setOpen(false);
    setValues(EMPTY);
    router.refresh();
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button>
          <Shirt /> Nueva orden
        </Button>
      </SheetTrigger>
      <SheetContent className="overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Nueva orden de lavado</SheetTitle>
          <SheetDescription>Registra las prendas y el cliente de la orden.</SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col gap-5 overflow-y-auto px-4">
          <div className="space-y-3">
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Información principal
            </p>
            <div className="space-y-1.5">
              <Label>Cliente</Label>
              <CustomerCombobox
                customers={customers}
                value={values.customerId ?? ""}
                onChange={(value) =>
                  setValues((v) => ({ ...v, customerId: value || null }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="estimatedReadyAt">Fecha estimada de entrega</Label>
              <Input
                id="estimatedReadyAt"
                type="datetime-local"
                value={values.estimatedReadyAt ?? ""}
                onChange={(e) =>
                  setValues((v) => ({ ...v, estimatedReadyAt: e.target.value || null }))
                }
              />
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Prendas
            </p>
            {values.items.map((item, i) => (
              <div key={i} className="space-y-2 rounded-lg border border-border p-3">
                <div className="flex items-center gap-2">
                  <Input
                    value={item.description}
                    onChange={(e) => patchItem(i, { description: e.target.value })}
                    placeholder="Ej. Camisa blanca"
                    className="flex-1"
                  />
                  <button
                    type="button"
                    onClick={() => removeItem(i)}
                    className="shrink-0 text-muted-foreground hover:text-destructive"
                    disabled={values.items.length === 1}
                  >
                    <X className="size-4" />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Select
                    value={item.serviceId ?? "none"}
                    onValueChange={(value) =>
                      patchItem(i, { serviceId: value === "none" ? null : value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Servicio" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sin servicio</SelectItem>
                      {services.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    inputMode="decimal"
                    min={1}
                    value={item.quantity}
                    onChange={(e) =>
                      patchItem(i, { quantity: Number(e.target.value) || 1 })
                    }
                  />
                </div>
              </div>
            ))}
            <Button type="button" variant="ghost" size="sm" onClick={addItem}>
              <Plus /> Agregar prenda
            </Button>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes">Notas</Label>
            <Textarea
              id="notes"
              rows={3}
              value={values.notes}
              onChange={(e) => setValues((v) => ({ ...v, notes: e.target.value }))}
              placeholder="Instrucciones especiales..."
            />
          </div>
        </form>

        <SheetFooter>
          <Button type="submit" onClick={handleSubmit} disabled={saving}>
            {saving ? "Guardando..." : "Crear orden"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

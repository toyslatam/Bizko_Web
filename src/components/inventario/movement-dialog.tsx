"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowDownToLine, ArrowUpFromLine, SlidersHorizontal } from "lucide-react";
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
import { StockItemCombobox } from "@/components/inventario/stock-item-combobox";
import { createMovementAction } from "@/app/(app)/inventario/actions";
import { ADJUSTMENT_REASONS, OUT_REASONS, formatQuantity } from "@/lib/inventory";
import { UNIT_SHORT_LABELS } from "@/lib/catalog";
import type { StockItem } from "@/lib/stock-items";

type Mode = "in" | "out" | "adjustment";

const MODE_CONFIG: Record<Mode, { label: string; title: string; icon: typeof ArrowDownToLine; reasons: readonly string[] }> = {
  in: {
    label: "Entrada",
    title: "Registrar entrada",
    icon: ArrowDownToLine,
    reasons: ["Compra a proveedor", "Devolución de cliente", "Otro"],
  },
  out: {
    label: "Salida",
    title: "Registrar salida",
    icon: ArrowUpFromLine,
    reasons: OUT_REASONS,
  },
  adjustment: {
    label: "Ajuste",
    title: "Ajustar inventario",
    icon: SlidersHorizontal,
    reasons: ADJUSTMENT_REASONS,
  },
};

export function MovementDialog({ mode, items }: { mode: Mode; items: StockItem[] }) {
  const router = useRouter();
  const config = MODE_CONFIG[mode];
  const Icon = config.icon;

  const [open, setOpen] = React.useState(false);
  const [itemKey, setItemKey] = React.useState("");
  const [quantity, setQuantity] = React.useState("");
  const [physicalCount, setPhysicalCount] = React.useState("");
  const [reason, setReason] = React.useState<string>(config.reasons[0]);
  const [saving, setSaving] = React.useState(false);

  const selectedItem = items.find((i) => i.key === itemKey);

  function reset() {
    setItemKey("");
    setQuantity("");
    setPhysicalCount("");
    setReason(config.reasons[0]);
  }

  const adjustmentDelta =
    mode === "adjustment" && selectedItem && physicalCount !== ""
      ? Number(physicalCount) - selectedItem.stock
      : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedItem) {
      toast.error("Selecciona un producto.");
      return;
    }

    const qty = mode === "adjustment" ? adjustmentDelta : Number(quantity);
    if (qty === null || Number.isNaN(qty) || (mode !== "adjustment" && qty <= 0)) {
      toast.error("Ingresa una cantidad válida.");
      return;
    }
    if (mode === "adjustment" && qty === 0) {
      toast.error("El conteo físico es igual al stock actual, no hay nada que ajustar.");
      return;
    }

    setSaving(true);
    const result = await createMovementAction({
      productId: selectedItem.productId,
      variantId: selectedItem.variantId,
      movementType: mode,
      quantity: qty,
      reason,
    });
    setSaving(false);

    if ("error" in result) {
      toast.error(result.error);
      return;
    }

    toast.success(`${config.label} registrada correctamente.`);
    setOpen(false);
    reset();
    router.refresh();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Icon /> {config.label}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{config.title}</DialogTitle>
            <DialogDescription>
              Se registrará un movimiento de tipo &quot;{config.label}&quot; con trazabilidad completa.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
              <Label>Producto</Label>
              <StockItemCombobox items={items} value={itemKey} onChange={setItemKey} />
              {selectedItem && (
                <p className="text-xs text-muted-foreground">
                  Stock actual: {formatQuantity(selectedItem.stock)}{" "}
                  {UNIT_SHORT_LABELS[selectedItem.unit]}
                </p>
              )}
              {items.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Ningún producto tiene control de inventario activado todavía. Actívalo al
                  editar el producto, o agrégale variantes.
                </p>
              )}
            </div>

            {mode === "adjustment" ? (
              <div className="space-y-1.5">
                <Label htmlFor="physicalCount">Conteo físico</Label>
                <Input
                  id="physicalCount"
                  inputMode="decimal"
                  value={physicalCount}
                  onChange={(e) => setPhysicalCount(e.target.value)}
                  placeholder="0"
                />
                {adjustmentDelta !== null && (
                  <p className="text-xs text-muted-foreground">
                    Ajuste: {adjustmentDelta > 0 ? "+" : ""}
                    {formatQuantity(adjustmentDelta)}
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label htmlFor="movementQuantity">Cantidad</Label>
                <Input
                  id="movementQuantity"
                  inputMode="decimal"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="0"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Motivo</Label>
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {config.reasons.map((r) => (
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
              {saving ? "Guardando..." : `Confirmar ${config.label.toLowerCase()}`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

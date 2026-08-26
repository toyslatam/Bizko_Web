"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ProductCombobox } from "@/components/inventario/product-combobox";
import { addComboItemAction } from "@/app/(app)/productos/modifier-actions";
import type { Product } from "@/types/database";

export function AddComboItemDialog({
  comboProductId,
  availableProducts,
}: {
  comboProductId: string;
  availableProducts: Product[];
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [componentProductId, setComponentProductId] = React.useState("");
  const [quantity, setQuantity] = React.useState("1");
  const [saving, setSaving] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const result = await addComboItemAction(comboProductId, componentProductId, quantity);
    setSaving(false);

    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    toast.success("Producto agregado al combo.");
    setOpen(false);
    setComponentProductId("");
    setQuantity("1");
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus /> Agregar producto
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Agregar producto al combo</DialogTitle>
            <DialogDescription>Elige uno de tus productos y la cantidad que incluye el combo.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
              <Label>Producto</Label>
              <ProductCombobox
                products={availableProducts}
                value={componentProductId}
                onChange={setComponentProductId}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="comboItemQuantity">Cantidad</Label>
              <Input
                id="comboItemQuantity"
                inputMode="decimal"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="1"
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving || !componentProductId}>
              {saving ? "Guardando..." : "Agregar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Pencil } from "lucide-react";
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
import { createZoneAction, updateZoneAction, type ZoneInput } from "@/app/(app)/delivery/actions";
import type { DeliveryZone } from "@/types/database";

const EMPTY: ZoneInput = { name: "", description: "", deliveryFee: "", minimumOrder: "", estimatedTime: "" };

export function ZoneFormDialog({ zone }: { zone?: DeliveryZone }) {
  const router = useRouter();
  const isEdit = Boolean(zone);
  const [open, setOpen] = React.useState(false);
  const [values, setValues] = React.useState<ZoneInput>(
    zone
      ? {
          name: zone.name,
          description: zone.description ?? "",
          deliveryFee: (zone.delivery_fee_cents / 100).toString(),
          minimumOrder: (zone.minimum_order_cents / 100).toString(),
          estimatedTime: zone.estimated_time ?? "",
        }
      : EMPTY,
  );
  const [saving, setSaving] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const result = isEdit ? await updateZoneAction(zone!.id, values) : await createZoneAction(values);
    setSaving(false);

    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    toast.success(isEdit ? "Zona actualizada." : "Zona creada.");
    setOpen(false);
    if (!isEdit) setValues(EMPTY);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {isEdit ? (
          <Button variant="ghost" size="icon-sm">
            <Pencil />
          </Button>
        ) : (
          <Button>
            <Plus /> Nueva zona
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{isEdit ? "Editar zona" : "Nueva zona de entrega"}</DialogTitle>
            <DialogDescription>Ej. Zona Centro, Zona Norte...</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
              <Label htmlFor="zoneName">Nombre</Label>
              <Input
                id="zoneName"
                autoFocus
                value={values.name}
                onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
                placeholder="Centro"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="zoneFee">Costo de entrega</Label>
                <Input
                  id="zoneFee"
                  inputMode="decimal"
                  value={values.deliveryFee}
                  onChange={(e) => setValues((v) => ({ ...v, deliveryFee: e.target.value }))}
                  placeholder="0"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="zoneMin">Pedido mínimo</Label>
                <Input
                  id="zoneMin"
                  inputMode="decimal"
                  value={values.minimumOrder}
                  onChange={(e) => setValues((v) => ({ ...v, minimumOrder: e.target.value }))}
                  placeholder="0"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="zoneTime">Tiempo estimado (opcional)</Label>
              <Input
                id="zoneTime"
                value={values.estimatedTime}
                onChange={(e) => setValues((v) => ({ ...v, estimatedTime: e.target.value }))}
                placeholder="30-45 min"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="zoneDescription">Descripción (opcional)</Label>
              <Textarea
                id="zoneDescription"
                rows={2}
                value={values.description}
                onChange={(e) => setValues((v) => ({ ...v, description: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Guardando..." : isEdit ? "Guardar cambios" : "Crear zona"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

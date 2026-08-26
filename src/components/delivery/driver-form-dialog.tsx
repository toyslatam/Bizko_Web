"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Pencil } from "lucide-react";
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
import { createDriverAction, updateDriverAction, type DriverInput } from "@/app/(app)/delivery/actions";
import type { DeliveryDriver } from "@/types/database";

export function DriverFormDialog({ driver }: { driver?: DeliveryDriver }) {
  const router = useRouter();
  const isEdit = Boolean(driver);
  const [open, setOpen] = React.useState(false);
  const [values, setValues] = React.useState<DriverInput>(
    driver ? { name: driver.name, phone: driver.phone } : { name: "", phone: "" },
  );
  const [saving, setSaving] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const result = isEdit ? await updateDriverAction(driver!.id, values) : await createDriverAction(values);
    setSaving(false);

    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    toast.success(isEdit ? "Repartidor actualizado." : "Repartidor agregado.");
    setOpen(false);
    if (!isEdit) setValues({ name: "", phone: "" });
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
            <Plus /> Nuevo repartidor
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{isEdit ? "Editar repartidor" : "Nuevo repartidor"}</DialogTitle>
            <DialogDescription>Se le podrán asignar pedidos de entrega a domicilio.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
              <Label htmlFor="driverName">Nombre</Label>
              <Input
                id="driverName"
                autoFocus
                value={values.name}
                onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="driverPhone">Teléfono</Label>
              <Input
                id="driverPhone"
                value={values.phone}
                onChange={(e) => setValues((v) => ({ ...v, phone: e.target.value }))}
                placeholder="300 123 4567"
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Guardando..." : isEdit ? "Guardar cambios" : "Agregar repartidor"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

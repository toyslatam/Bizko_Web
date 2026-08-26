"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CarFront, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  createVehicleAction,
  updateVehicleAction,
  type VehicleInput,
} from "@/app/(app)/vehiculos/actions";
import type { Customer, Vehicle } from "@/types/database";

const EMPTY: VehicleInput = {
  customerId: "",
  plate: "",
  brand: "",
  model: "",
  color: "",
  notes: "",
};

export function VehicleFormSheet({
  vehicle,
  customers,
}: {
  vehicle?: Vehicle;
  customers: Customer[];
}) {
  const router = useRouter();
  const isEdit = Boolean(vehicle);
  const [open, setOpen] = React.useState(false);
  const [values, setValues] = React.useState<VehicleInput>(
    vehicle
      ? {
          customerId: vehicle.customer_id,
          plate: vehicle.plate,
          brand: vehicle.brand ?? "",
          model: vehicle.model ?? "",
          color: vehicle.color ?? "",
          notes: vehicle.notes ?? "",
        }
      : EMPTY,
  );
  const [errors, setErrors] = React.useState<Partial<Record<keyof VehicleInput, string>>>({});
  const [saving, setSaving] = React.useState(false);

  function patch<K extends keyof VehicleInput>(key: K, value: VehicleInput[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErrors({});

    const result = isEdit
      ? await updateVehicleAction(vehicle!.id, values)
      : await createVehicleAction(values);
    setSaving(false);

    if ("error" in result) {
      setErrors(result.fieldErrors ?? {});
      toast.error(result.error);
      return;
    }

    toast.success(isEdit ? "Vehículo actualizado." : "Vehículo creado correctamente.");
    setOpen(false);
    if (!isEdit) setValues(EMPTY);
    router.refresh();
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {isEdit ? (
          <Button variant="outline" size="sm">
            <Pencil /> Editar
          </Button>
        ) : (
          <Button>
            <CarFront /> Nuevo vehículo
          </Button>
        )}
      </SheetTrigger>
      <SheetContent className="overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{isEdit ? "Editar vehículo" : "Nuevo vehículo"}</SheetTitle>
          <SheetDescription>
            {isEdit ? "Actualiza la información del vehículo." : "Agrega un vehículo a tu negocio."}
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col gap-5 overflow-y-auto px-4">
          <div className="space-y-3">
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Información principal
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="customerId">Cliente</Label>
              <CustomerCombobox
                customers={customers}
                value={values.customerId}
                onChange={(v) => patch("customerId", v)}
              />
              {errors.customerId && (
                <p className="text-xs text-destructive">{errors.customerId}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="plate">Placa</Label>
              <Input
                id="plate"
                autoFocus
                value={values.plate}
                onChange={(e) => patch("plate", e.target.value)}
                aria-invalid={Boolean(errors.plate)}
              />
              {errors.plate && <p className="text-xs text-destructive">{errors.plate}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="brand">Marca</Label>
                <Input
                  id="brand"
                  value={values.brand}
                  onChange={(e) => patch("brand", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="model">Modelo</Label>
                <Input
                  id="model"
                  value={values.model}
                  onChange={(e) => patch("model", e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="color">Color</Label>
              <Input
                id="color"
                value={values.color}
                onChange={(e) => patch("color", e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Información adicional
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="notes">Notas</Label>
              <Textarea
                id="notes"
                rows={3}
                value={values.notes}
                onChange={(e) => patch("notes", e.target.value)}
                placeholder="Detalles del vehículo, historial, referencias..."
              />
            </div>
          </div>
        </form>

        <SheetFooter>
          <Button type="submit" onClick={handleSubmit} disabled={saving}>
            {saving ? "Guardando..." : isEdit ? "Guardar cambios" : "Crear vehículo"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

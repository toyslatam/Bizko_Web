"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Wrench } from "lucide-react";
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
import { createWorkOrderAction } from "@/app/(app)/ordenes-trabajo/actions";
import type { Customer, Vehicle } from "@/types/database";

const NO_VEHICLE_VALUE = "none";

export function WorkOrderFormSheet({
  customers,
  vehicles,
}: {
  customers: Customer[];
  vehicles: Vehicle[];
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [customerId, setCustomerId] = React.useState("");
  const [vehicleId, setVehicleId] = React.useState(NO_VEHICLE_VALUE);
  const [description, setDescription] = React.useState("");
  const [estimatedTotal, setEstimatedTotal] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  function reset() {
    setCustomerId("");
    setVehicleId(NO_VEHICLE_VALUE);
    setDescription("");
    setEstimatedTotal("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    const estimatedTotalCents = estimatedTotal
      ? Math.round(Number(estimatedTotal.replace(",", ".")) * 100)
      : null;

    const result = await createWorkOrderAction({
      customerId: customerId || null,
      vehicleId: vehicleId === NO_VEHICLE_VALUE ? null : vehicleId,
      description,
      estimatedTotalCents,
    });
    setSaving(false);

    if ("error" in result) {
      toast.error(result.error);
      return;
    }

    toast.success("Orden de trabajo creada correctamente.");
    setOpen(false);
    reset();
    router.refresh();
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button>
          <Wrench /> Nueva orden
        </Button>
      </SheetTrigger>
      <SheetContent className="overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Nueva orden de trabajo</SheetTitle>
          <SheetDescription>
            Registra el ingreso de un vehículo para reparación o mantenimiento.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col gap-5 overflow-y-auto px-4">
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Cliente</Label>
              <CustomerCombobox customers={customers} value={customerId} onChange={setCustomerId} />
            </div>

            <div className="space-y-1.5">
              <Label>Vehículo</Label>
              {vehicles.length > 0 ? (
                <Select value={vehicleId} onValueChange={setVehicleId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecciona un vehículo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_VEHICLE_VALUE}>Sin vehículo</SelectItem>
                    {vehicles.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {[v.plate, v.brand, v.model].filter(Boolean).join(" — ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                  Todavía no tienes vehículos registrados. Regístralo primero en{" "}
                  <Link href="/vehiculos" className="font-medium text-brand underline">
                    Vehículos
                  </Link>
                  .
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="description">Descripción</Label>
              <Textarea
                id="description"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="¿Qué reporta el cliente?"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="estimatedTotal">Total estimado</Label>
              <div className="relative">
                <span className="absolute top-1/2 left-2.5 -translate-y-1/2 text-sm text-muted-foreground">
                  $
                </span>
                <Input
                  id="estimatedTotal"
                  inputMode="decimal"
                  value={estimatedTotal}
                  onChange={(e) => setEstimatedTotal(e.target.value)}
                  placeholder="0"
                  className="pl-6"
                />
              </div>
            </div>
          </div>
        </form>

        <SheetFooter>
          <Button type="submit" onClick={handleSubmit} disabled={saving}>
            {saving ? "Creando..." : "Crear orden"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

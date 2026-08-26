"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowRight, MapPin, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { updateDeliverySettingsAction } from "@/app/(app)/configuracion/actions";
import type { Company } from "@/types/database";

export function DeliverySettingsForm({ company, canEdit }: { company: Company; canEdit: boolean }) {
  const [deliveryEnabled, setDeliveryEnabled] = React.useState(company.delivery_enabled);
  const [pickupEnabled, setPickupEnabled] = React.useState(company.pickup_enabled);
  const [saving, setSaving] = React.useState(false);

  async function handleChange(next: { deliveryEnabled?: boolean; pickupEnabled?: boolean }) {
    const nextDelivery = next.deliveryEnabled ?? deliveryEnabled;
    const nextPickup = next.pickupEnabled ?? pickupEnabled;
    setDeliveryEnabled(nextDelivery);
    setPickupEnabled(nextPickup);
    setSaving(true);
    const result = await updateDeliverySettingsAction({
      companyId: company.id,
      deliveryEnabled: nextDelivery,
      pickupEnabled: nextPickup,
    });
    setSaving(false);

    if ("error" in result) {
      toast.error(result.error);
      setDeliveryEnabled(company.delivery_enabled);
      setPickupEnabled(company.pickup_enabled);
      return;
    }
    toast.success("Preferencias de entrega actualizadas.");
  }

  return (
    <div className="max-w-2xl space-y-4">
      <div className="space-y-3 rounded-xl border border-border bg-card p-4">
        <p className="text-sm font-semibold text-foreground">Métodos de entrega</p>
        <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
          <div className="flex items-center gap-2.5">
            <Truck className="size-4 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium text-foreground">Entrega a domicilio</p>
              <p className="text-xs text-muted-foreground">Tus clientes podrán pedir con envío.</p>
            </div>
          </div>
          <Switch
            checked={deliveryEnabled}
            disabled={!canEdit || saving}
            onCheckedChange={(checked) => handleChange({ deliveryEnabled: checked })}
          />
        </div>
        <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
          <div className="flex items-center gap-2.5">
            <MapPin className="size-4 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium text-foreground">Recoger en tienda</p>
              <p className="text-xs text-muted-foreground">Tus clientes podrán recoger su pedido.</p>
            </div>
          </div>
          <Switch
            checked={pickupEnabled}
            disabled={!canEdit || saving}
            onCheckedChange={(checked) => handleChange({ pickupEnabled: checked })}
          />
        </div>
      </div>

      {deliveryEnabled && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Link
            href="/delivery/zonas"
            className="flex items-center justify-between rounded-xl border border-border bg-card p-4 hover:bg-muted/50"
          >
            <div>
              <p className="text-sm font-medium text-foreground">Zonas y barrios</p>
              <p className="text-xs text-muted-foreground">Costo, pedido mínimo y tiempo estimado.</p>
            </div>
            <ArrowRight className="size-4 text-muted-foreground" />
          </Link>
          <Link
            href="/delivery/repartidores"
            className="flex items-center justify-between rounded-xl border border-border bg-card p-4 hover:bg-muted/50"
          >
            <div>
              <p className="text-sm font-medium text-foreground">Repartidores</p>
              <p className="text-xs text-muted-foreground">Administra tu equipo de entregas.</p>
            </div>
            <ArrowRight className="size-4 text-muted-foreground" />
          </Link>
        </div>
      )}
    </div>
  );
}

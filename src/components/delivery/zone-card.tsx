"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Clock, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { ZoneFormDialog } from "@/components/delivery/zone-form-dialog";
import { createAreaAction, deleteAreaAction, setZoneActiveAction } from "@/app/(app)/delivery/actions";
import { formatCurrencyCents } from "@/lib/format";
import type { DeliveryArea, DeliveryZone } from "@/types/database";

export function ZoneCard({ zone, areas }: { zone: DeliveryZone; areas: DeliveryArea[] }) {
  const router = useRouter();
  const [newArea, setNewArea] = React.useState("");
  const [addingArea, setAddingArea] = React.useState(false);

  async function handleToggleActive(checked: boolean) {
    const result = await setZoneActiveAction(zone.id, checked);
    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    router.refresh();
  }

  async function handleAddArea(e: React.FormEvent) {
    e.preventDefault();
    if (!newArea.trim()) return;
    setAddingArea(true);
    const result = await createAreaAction(zone.id, newArea);
    setAddingArea(false);
    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    setNewArea("");
    router.refresh();
  }

  async function handleRemoveArea(id: string) {
    const result = await deleteAreaAction(id);
    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <p className="font-medium text-foreground">{zone.name}</p>
            <Badge variant={zone.is_active ? "default" : "outline"}>
              {zone.is_active ? "Activa" : "Inactiva"}
            </Badge>
          </div>
          {zone.description && <p className="text-sm text-muted-foreground">{zone.description}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <ZoneFormDialog zone={zone} />
          <Switch checked={zone.is_active} onCheckedChange={handleToggleActive} />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-3 text-sm">
        <span className="text-foreground">Costo: {formatCurrencyCents(zone.delivery_fee_cents)}</span>
        {zone.minimum_order_cents > 0 && (
          <span className="text-muted-foreground">Mínimo: {formatCurrencyCents(zone.minimum_order_cents)}</span>
        )}
        {zone.estimated_time && (
          <span className="flex items-center gap-1 text-muted-foreground">
            <Clock className="size-3.5" /> {zone.estimated_time}
          </span>
        )}
      </div>

      <div className="mt-3">
        <p className="mb-1.5 text-xs font-medium text-muted-foreground">Barrios / sectores</p>
        <div className="flex flex-wrap gap-1.5">
          {areas.map((a) => (
            <span
              key={a.id}
              className="flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-foreground"
            >
              {a.name}
              <button type="button" onClick={() => handleRemoveArea(a.id)} className="text-muted-foreground hover:text-destructive">
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
        <form onSubmit={handleAddArea} className="mt-2 flex gap-2">
          <Input
            value={newArea}
            onChange={(e) => setNewArea(e.target.value)}
            placeholder="Agregar barrio..."
            className="h-8 max-w-48 text-sm"
          />
          <Button type="submit" size="sm" variant="outline" disabled={addingArea || !newArea.trim()}>
            Agregar
          </Button>
        </form>
      </div>
    </div>
  );
}

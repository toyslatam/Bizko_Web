"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
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
  setWorkOrderStatusAction,
  updateWorkOrderDetailsAction,
} from "@/app/(app)/ordenes-trabajo/actions";
import { WORK_ORDER_STATUS_LABELS } from "@/lib/catalog";
import type { WorkOrder, WorkOrderStatus } from "@/types/database";

const STATUS_OPTIONS = Object.entries(WORK_ORDER_STATUS_LABELS) as [WorkOrderStatus, string][];

export function WorkOrderStatusPanel({ order }: { order: WorkOrder }) {
  const router = useRouter();
  const [statusSaving, setStatusSaving] = React.useState(false);
  const [diagnosis, setDiagnosis] = React.useState(order.diagnosis ?? "");
  const [finalTotal, setFinalTotal] = React.useState(
    order.final_total_cents != null ? (order.final_total_cents / 100).toString() : "",
  );
  const [detailsSaving, setDetailsSaving] = React.useState(false);

  async function handleStatusChange(status: WorkOrderStatus) {
    setStatusSaving(true);
    const result = await setWorkOrderStatusAction(order.id, status);
    setStatusSaving(false);

    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    toast.success(`Orden marcada como "${WORK_ORDER_STATUS_LABELS[status]}".`);
    router.refresh();
  }

  async function handleDetailsSubmit(e: React.FormEvent) {
    e.preventDefault();
    setDetailsSaving(true);

    const finalTotalCents = finalTotal
      ? Math.round(Number(finalTotal.replace(",", ".")) * 100)
      : null;

    const result = await updateWorkOrderDetailsAction(order.id, { diagnosis, finalTotalCents });
    setDetailsSaving(false);

    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    toast.success("Detalles de la orden actualizados.");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label>Estado</Label>
        <Select
          value={order.status}
          onValueChange={(v) => handleStatusChange(v as WorkOrderStatus)}
          disabled={statusSaving}
        >
          <SelectTrigger className="w-full sm:w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <form
        onSubmit={handleDetailsSubmit}
        className="space-y-3 rounded-xl border border-border bg-card p-4"
      >
        <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Diagnóstico y total final
        </p>
        <div className="space-y-1.5">
          <Label htmlFor="diagnosis">Diagnóstico</Label>
          <Textarea
            id="diagnosis"
            rows={3}
            value={diagnosis}
            onChange={(e) => setDiagnosis(e.target.value)}
            placeholder="¿Qué encontraste al revisar el vehículo?"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="finalTotal">Total final</Label>
          <div className="relative w-full sm:w-48">
            <span className="absolute top-1/2 left-2.5 -translate-y-1/2 text-sm text-muted-foreground">
              $
            </span>
            <Input
              id="finalTotal"
              inputMode="decimal"
              value={finalTotal}
              onChange={(e) => setFinalTotal(e.target.value)}
              placeholder="0"
              className="pl-6"
            />
          </div>
        </div>
        <Button type="submit" disabled={detailsSaving}>
          {detailsSaving ? "Guardando..." : "Guardar detalles"}
        </Button>
      </form>
    </div>
  );
}

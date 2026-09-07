"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, Plus } from "lucide-react";
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
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { upsertCommissionRuleAction } from "@/app/(app)/profesionales/actions";
import type { CommissionRule, CommissionType } from "@/types/database";

export function CommissionRuleDialog({
  professionalId,
  serviceId,
  label,
  rule,
}: {
  professionalId: string;
  serviceId: string | null;
  label: string;
  rule?: CommissionRule;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [commissionType, setCommissionType] = React.useState<CommissionType>(
    rule?.commission_type ?? "percentage",
  );
  const [value, setValue] = React.useState(
    rule ? (rule.commission_type === "fixed" ? (rule.value / 100).toString() : rule.value.toString()) : "",
  );
  const [saving, setSaving] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const result = await upsertCommissionRuleAction(professionalId, serviceId, commissionType, value);
    setSaving(false);

    if ("error" in result) {
      toast.error(result.error);
      return;
    }

    toast.success("Comisión guardada.");
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          {rule ? <Pencil /> : <Plus />} {rule ? "Editar" : "Configurar"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Comisión — {label}</DialogTitle>
            <DialogDescription>
              Define cómo se calcula la comisión de este profesional.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-3">
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select value={commissionType} onValueChange={(v) => setCommissionType(v as CommissionType)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentage">Porcentaje</SelectItem>
                  <SelectItem value="fixed">Fijo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="commissionValue">
                Valor {commissionType === "percentage" ? "(%)" : "($)"}
              </Label>
              <Input
                id="commissionValue"
                inputMode="decimal"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={commissionType === "percentage" ? "40" : "0"}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={saving}>
              {saving ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

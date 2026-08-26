"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus } from "lucide-react";
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
import { createSegmentAction } from "@/app/(app)/marketing/actions";
import { SEGMENT_CONDITION_LABELS } from "@/lib/marketing";
import { LEAD_SOURCE_LABELS } from "@/lib/crm";
import { createClient } from "@/lib/supabase/client";
import type { LeadSource, ProductCategory, SegmentConditionType } from "@/types/database";

const CONDITION_TYPES = Object.keys(SEGMENT_CONDITION_LABELS) as SegmentConditionType[];
const LEAD_SOURCES = Object.keys(LEAD_SOURCE_LABELS) as LeadSource[];

export function SegmentFormDialog({
  companyId,
  categories,
}: {
  companyId: string;
  categories: ProductCategory[];
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [name, setName] = React.useState("");
  const [conditionType, setConditionType] = React.useState<SegmentConditionType>("purchased_last_days");
  const [days, setDays] = React.useState("30");
  const [categoryId, setCategoryId] = React.useState("");
  const [minAmount, setMinAmount] = React.useState("");
  const [source, setSource] = React.useState<LeadSource>("instagram");
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [previewCount, setPreviewCount] = React.useState<number | null>(null);
  const [previewLoading, setPreviewLoading] = React.useState(false);

  function reset() {
    setName("");
    setConditionType("purchased_last_days");
    setDays("30");
    setCategoryId("");
    setMinAmount("");
    setSource("instagram");
    setErrors({});
    setPreviewCount(null);
  }

  function buildConditionValue(): Record<string, unknown> | null {
    switch (conditionType) {
      case "purchased_last_days":
      case "inactive_days": {
        const n = Number(days);
        if (!Number.isFinite(n) || n <= 0) return null;
        return { days: n };
      }
      case "category_id":
        return categoryId ? { category_id: categoryId } : null;
      case "min_total_spent": {
        const n = Number(minAmount);
        if (!Number.isFinite(n) || n <= 0) return null;
        return { min_cents: Math.round(n * 100) };
      }
      case "lead_source":
        return { source };
    }
  }

  React.useEffect(() => {
    const value = buildConditionValue();

    const timeout = setTimeout(async () => {
      if (!open || !value) {
        setPreviewLoading(false);
        setPreviewCount(null);
        return;
      }

      setPreviewLoading(true);
      const supabase = createClient();
      const { data, error } = await supabase.rpc("count_segment_customers", {
        p_company_id: companyId,
        p_condition_type: conditionType,
        p_condition_value: value,
      });
      setPreviewLoading(false);
      setPreviewCount(error ? null : (data as number));
    }, 400);

    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, conditionType, days, categoryId, minAmount, source, companyId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});

    const value = buildConditionValue();
    if (!value) {
      setErrors({ condition: "Completa la condición del segmento." });
      return;
    }

    setSaving(true);
    const result = await createSegmentAction({ name, conditionType, conditionValue: value });
    setSaving(false);

    if ("error" in result) {
      toast.error(result.error);
      if (result.fieldErrors) setErrors(result.fieldErrors);
      return;
    }

    toast.success("Segmento creado.");
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
        <Button size="sm">
          <Plus /> Nuevo segmento
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Nuevo segmento</DialogTitle>
            <DialogDescription>Define una condición para agrupar clientes.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
              <Label htmlFor="segmentName">Nombre</Label>
              <Input
                id="segmentName"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej. Clientes frecuentes de comida"
                aria-invalid={Boolean(errors.name)}
              />
              {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
            </div>

            <div className="space-y-1.5">
              <Label>Condición</Label>
              <Select
                value={conditionType}
                onValueChange={(v) => setConditionType(v as SegmentConditionType)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONDITION_TYPES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {SEGMENT_CONDITION_LABELS[c]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {(conditionType === "purchased_last_days" || conditionType === "inactive_days") && (
              <div className="space-y-1.5">
                <Label htmlFor="segmentDays">Días</Label>
                <Input
                  id="segmentDays"
                  type="number"
                  min={1}
                  value={days}
                  onChange={(e) => setDays(e.target.value)}
                />
              </div>
            )}

            {conditionType === "category_id" && (
              <div className="space-y-1.5">
                <Label>Categoría</Label>
                <Select value={categoryId} onValueChange={setCategoryId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecciona una categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {conditionType === "min_total_spent" && (
              <div className="space-y-1.5">
                <Label htmlFor="segmentMinAmount">Monto mínimo (pesos)</Label>
                <Input
                  id="segmentMinAmount"
                  type="number"
                  min={0}
                  value={minAmount}
                  onChange={(e) => setMinAmount(e.target.value)}
                  placeholder="0"
                />
              </div>
            )}

            {conditionType === "lead_source" && (
              <div className="space-y-1.5">
                <Label>Canal de origen</Label>
                <Select value={source} onValueChange={(v) => setSource(v as LeadSource)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LEAD_SOURCES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {LEAD_SOURCE_LABELS[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {errors.condition && <p className="text-xs text-destructive">{errors.condition}</p>}

            <div className="rounded-lg border border-dashed border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
              {previewLoading
                ? "Calculando coincidencias..."
                : previewCount !== null
                  ? `≈ ${previewCount} cliente${previewCount === 1 ? "" : "s"} coinciden`
                  : "Completa la condición para ver una vista previa."}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Creando..." : "Crear segmento"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

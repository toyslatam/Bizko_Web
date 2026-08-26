"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { UserPlus, Pencil } from "lucide-react";
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
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
  SheetTrigger,
} from "@/components/ui/sheet";
import { createLeadAction, updateLeadAction, type LeadInput } from "@/app/(app)/crm/leads/actions";
import { LEAD_SOURCE_LABELS } from "@/lib/crm";
import type { Lead, LeadSource } from "@/types/database";

const SOURCES = Object.keys(LEAD_SOURCE_LABELS) as LeadSource[];

const EMPTY: LeadInput = {
  name: "",
  phone: "",
  email: "",
  companyName: "",
  source: "manual",
  productInterest: "",
  potentialValue: "",
};

export function LeadFormSheet({ lead }: { lead?: Lead }) {
  const router = useRouter();
  const isEdit = Boolean(lead);
  const [open, setOpen] = React.useState(false);
  const [values, setValues] = React.useState<LeadInput>(
    lead
      ? {
          name: lead.name,
          phone: lead.phone ?? "",
          email: lead.email ?? "",
          companyName: lead.company_name ?? "",
          source: lead.source,
          productInterest: lead.product_interest ?? "",
          potentialValue: lead.potential_value_cents != null ? (lead.potential_value_cents / 100).toString() : "",
        }
      : EMPTY,
  );
  const [errors, setErrors] = React.useState<Partial<Record<"name", string>>>({});
  const [saving, setSaving] = React.useState(false);

  function patch<K extends keyof LeadInput>(key: K, value: LeadInput[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErrors({});

    const result = isEdit ? await updateLeadAction(lead!.id, values) : await createLeadAction(values);
    setSaving(false);

    if ("error" in result) {
      setErrors(result.fieldErrors ?? {});
      toast.error(result.error);
      return;
    }

    toast.success(isEdit ? "Lead actualizado." : "Lead creado correctamente.");
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
            <UserPlus /> Nuevo lead
          </Button>
        )}
      </SheetTrigger>
      <SheetContent className="overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{isEdit ? "Editar lead" : "Nuevo lead"}</SheetTitle>
          <SheetDescription>
            {isEdit ? "Actualiza la información del lead." : "Agrega un contacto interesado a tu pipeline."}
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col gap-4 overflow-y-auto px-4">
          <div className="space-y-1.5">
            <Label htmlFor="leadName">Nombre</Label>
            <Input
              id="leadName"
              autoFocus
              value={values.name}
              onChange={(e) => patch("name", e.target.value)}
              aria-invalid={Boolean(errors.name)}
            />
            {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="leadPhone">Teléfono</Label>
              <Input id="leadPhone" value={values.phone} onChange={(e) => patch("phone", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="leadEmail">Correo</Label>
              <Input id="leadEmail" value={values.email} onChange={(e) => patch("email", e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="leadCompanyName">Empresa (opcional)</Label>
            <Input
              id="leadCompanyName"
              value={values.companyName}
              onChange={(e) => patch("companyName", e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Origen</Label>
              <Select value={values.source} onValueChange={(v) => patch("source", v as LeadSource)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SOURCES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {LEAD_SOURCE_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="leadPotentialValue">Valor potencial</Label>
              <Input
                id="leadPotentialValue"
                inputMode="decimal"
                placeholder="0"
                value={values.potentialValue}
                onChange={(e) => patch("potentialValue", e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="leadProductInterest">Producto de interés (opcional)</Label>
            <Input
              id="leadProductInterest"
              value={values.productInterest}
              onChange={(e) => patch("productInterest", e.target.value)}
            />
          </div>
        </form>

        <SheetFooter>
          <Button type="submit" onClick={handleSubmit} disabled={saving}>
            {saving ? "Guardando..." : isEdit ? "Guardar cambios" : "Crear lead"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

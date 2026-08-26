"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
import {
  createModifierGroupAction,
  updateModifierGroupAction,
  type ModifierGroupInput,
  type ModifierOptionInput,
} from "@/app/(app)/productos/modifier-actions";
import type { ModifierGroup, ModifierOption } from "@/types/database";

const EMPTY_OPTION: ModifierOptionInput = { name: "", price: "" };

const EMPTY: ModifierGroupInput = {
  name: "",
  selectionType: "single",
  isRequired: false,
  maxSelections: "",
  options: [{ ...EMPTY_OPTION }],
};

export function ModifierGroupFormDialog({
  productId,
  group,
  options,
}: {
  productId: string;
  group?: ModifierGroup;
  options?: ModifierOption[];
}) {
  const router = useRouter();
  const isEdit = Boolean(group);
  const [open, setOpen] = React.useState(false);
  const [values, setValues] = React.useState<ModifierGroupInput>(
    group
      ? {
          name: group.name,
          selectionType: group.selection_type,
          isRequired: group.is_required,
          maxSelections: group.max_selections?.toString() ?? "",
          options: (options ?? []).map((o) => ({ name: o.name, price: (o.price_cents / 100).toString() })),
        }
      : EMPTY,
  );
  const [saving, setSaving] = React.useState(false);

  function patch<K extends keyof ModifierGroupInput>(key: K, value: ModifierGroupInput[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  function patchOption(index: number, patch: Partial<ModifierOptionInput>) {
    setValues((v) => ({
      ...v,
      options: v.options.map((o, i) => (i === index ? { ...o, ...patch } : o)),
    }));
  }

  function addOption() {
    setValues((v) => ({ ...v, options: [...v.options, { ...EMPTY_OPTION }] }));
  }

  function removeOption(index: number) {
    setValues((v) => ({ ...v, options: v.options.filter((_, i) => i !== index) }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const result = isEdit
      ? await updateModifierGroupAction(group!.id, productId, values)
      : await createModifierGroupAction(productId, values);
    setSaving(false);

    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    toast.success(isEdit ? "Grupo de modificadores actualizado." : "Grupo de modificadores creado.");
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
          <Button size="sm">
            <Plus /> Nuevo grupo
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{isEdit ? "Editar grupo de modificadores" : "Nuevo grupo de modificadores"}</DialogTitle>
            <DialogDescription>Ej. &quot;Elige tu salsa&quot;, &quot;Adicionales&quot;, &quot;Tamaño&quot;.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
              <Label htmlFor="modifierGroupName">Nombre del grupo</Label>
              <Input
                id="modifierGroupName"
                autoFocus
                value={values.name}
                onChange={(e) => patch("name", e.target.value)}
                placeholder="Elige tu salsa"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Tipo de selección</Label>
                <Select
                  value={values.selectionType}
                  onValueChange={(v) => patch("selectionType", v as ModifierGroupInput["selectionType"])}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="single">Una opción</SelectItem>
                    <SelectItem value="multiple">Varias opciones</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {values.selectionType === "multiple" && (
                <div className="space-y-1.5">
                  <Label htmlFor="modifierMaxSelections">Máximo (opcional)</Label>
                  <Input
                    id="modifierMaxSelections"
                    inputMode="numeric"
                    value={values.maxSelections}
                    onChange={(e) => patch("maxSelections", e.target.value)}
                    placeholder="Sin límite"
                  />
                </div>
              )}
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
              <div>
                <p className="text-sm font-medium text-foreground">Obligatorio</p>
                <p className="text-xs text-muted-foreground">El cliente debe elegir una opción de este grupo.</p>
              </div>
              <Switch checked={values.isRequired} onCheckedChange={(checked) => patch("isRequired", checked)} />
            </div>

            <div className="space-y-2">
              <Label>Opciones</Label>
              {values.options.map((option, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    value={option.name}
                    onChange={(e) => patchOption(i, { name: e.target.value })}
                    placeholder="BBQ"
                    className="flex-1"
                  />
                  <Input
                    inputMode="decimal"
                    value={option.price}
                    onChange={(e) => patchOption(i, { price: e.target.value })}
                    placeholder="0"
                    className="w-24"
                  />
                  <button
                    type="button"
                    onClick={() => removeOption(i)}
                    className="shrink-0 text-muted-foreground hover:text-destructive"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              ))}
              <Button type="button" variant="ghost" size="sm" onClick={addOption}>
                <Plus /> Agregar opción
              </Button>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Guardando..." : isEdit ? "Guardar cambios" : "Crear grupo"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

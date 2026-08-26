"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  createCategoryAction,
  updateCategoryAction,
  type CategoryInput,
  type CategoryKind,
} from "@/app/(app)/categorias/actions";
import type { ExpenseCategory, ProductCategory, ServiceCategory } from "@/types/database";

export function CategoryFormDialog({
  kind,
  category,
}: {
  kind: CategoryKind;
  category?: ProductCategory | ServiceCategory | ExpenseCategory;
}) {
  const router = useRouter();
  const isEdit = Boolean(category);
  const [open, setOpen] = React.useState(false);
  const [values, setValues] = React.useState<CategoryInput>({
    name: category?.name ?? "",
    description: category?.description ?? "",
  });
  const [errors, setErrors] = React.useState<Partial<Record<keyof CategoryInput, string>>>({});
  const [saving, setSaving] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErrors({});

    const result = isEdit
      ? await updateCategoryAction(kind, category!.id, values)
      : await createCategoryAction(kind, values);
    setSaving(false);

    if ("error" in result) {
      setErrors(result.fieldErrors ?? {});
      toast.error(result.error);
      return;
    }

    toast.success(isEdit ? "Categoría actualizada." : "Categoría creada.");
    setOpen(false);
    if (!isEdit) setValues({ name: "", description: "" });
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
            <Plus /> Nueva categoría
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{isEdit ? "Editar categoría" : "Nueva categoría"}</DialogTitle>
            <DialogDescription>
              {kind === "product"
                ? "Categoría de productos."
                : kind === "service"
                  ? "Categoría de servicios."
                  : "Categoría de gastos."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
              <Label htmlFor="categoryName">Nombre</Label>
              <Input
                id="categoryName"
                autoFocus
                value={values.name}
                onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
                aria-invalid={Boolean(errors.name)}
              />
              {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="categoryDescription">Descripción (opcional)</Label>
              <Textarea
                id="categoryDescription"
                rows={2}
                value={values.description}
                onChange={(e) => setValues((v) => ({ ...v, description: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Guardando..." : isEdit ? "Guardar cambios" : "Crear categoría"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

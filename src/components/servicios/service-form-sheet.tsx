"use client";

import * as React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Wrench, Pencil, ImagePlus, X } from "lucide-react";
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
import {
  createServiceAction,
  updateServiceAction,
  type ServiceInput,
} from "@/app/(app)/servicios/actions";
import { uploadCompanyFile } from "@/lib/storage";
import type { Service, ServiceCategory } from "@/types/database";

const EMPTY: ServiceInput = {
  name: "",
  description: "",
  categoryId: null,
  price: "",
  durationMinutes: "",
  imageUrl: null,
};

export function ServiceFormSheet({
  companyId,
  categories,
  service,
}: {
  companyId: string;
  categories: ServiceCategory[];
  service?: Service;
}) {
  const router = useRouter();
  const isEdit = Boolean(service);
  const [open, setOpen] = React.useState(false);
  const [values, setValues] = React.useState<ServiceInput>(
    service
      ? {
          name: service.name,
          description: service.description ?? "",
          categoryId: service.category_id,
          price: (service.price_cents / 100).toString(),
          durationMinutes: service.duration_minutes?.toString() ?? "",
          imageUrl: service.image_url,
        }
      : EMPTY,
  );
  const [errors, setErrors] = React.useState<Partial<Record<"name" | "price", string>>>({});
  const [saving, setSaving] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);

  function patch<K extends keyof ServiceInput>(key: K, value: ServiceInput[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  async function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadCompanyFile("product-images", companyId, file);
      patch("imageUrl", url);
    } catch {
      toast.error("No pudimos subir la imagen.");
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErrors({});

    const result = isEdit
      ? await updateServiceAction(service!.id, values)
      : await createServiceAction(values);
    setSaving(false);

    if ("error" in result) {
      setErrors(result.fieldErrors ?? {});
      toast.error(result.error);
      return;
    }

    toast.success(isEdit ? "Servicio actualizado." : "Servicio creado correctamente.");
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
            <Wrench /> Nuevo servicio
          </Button>
        )}
      </SheetTrigger>
      <SheetContent className="overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{isEdit ? "Editar servicio" : "Nuevo servicio"}</SheetTitle>
          <SheetDescription>
            {isEdit ? "Actualiza la información del servicio." : "Agrega un servicio a tu catálogo."}
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col gap-5 overflow-y-auto px-4">
          <div className="space-y-3">
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Información principal
            </p>

            <div className="flex items-center gap-3">
              <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-muted">
                {values.imageUrl ? (
                  <Image src={values.imageUrl} alt="" width={64} height={64} className="size-full object-cover" />
                ) : (
                  <ImagePlus className="size-5 text-muted-foreground" />
                )}
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="serviceImage" className="cursor-pointer text-sm font-medium text-brand">
                  {uploading ? "Subiendo..." : values.imageUrl ? "Cambiar imagen" : "Subir imagen"}
                </Label>
                <input
                  id="serviceImage"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={uploading}
                  onChange={handleImageChange}
                />
                {values.imageUrl && (
                  <button
                    type="button"
                    onClick={() => patch("imageUrl", null)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <X className="size-4" />
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="serviceName">Nombre</Label>
              <Input
                id="serviceName"
                autoFocus
                value={values.name}
                onChange={(e) => patch("name", e.target.value)}
                aria-invalid={Boolean(errors.name)}
              />
              {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="servicePrice">Precio</Label>
                <Input
                  id="servicePrice"
                  inputMode="decimal"
                  value={values.price}
                  onChange={(e) => patch("price", e.target.value)}
                  placeholder="0"
                  aria-invalid={Boolean(errors.price)}
                />
                {errors.price && <p className="text-xs text-destructive">{errors.price}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="serviceDuration">Duración (min, opcional)</Label>
                <Input
                  id="serviceDuration"
                  inputMode="numeric"
                  value={values.durationMinutes}
                  onChange={(e) => patch("durationMinutes", e.target.value)}
                  placeholder="30"
                />
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Información adicional
            </p>
            <div className="space-y-1.5">
              <Label>Categoría</Label>
              <Select
                value={values.categoryId ?? "none"}
                onValueChange={(v) => patch("categoryId", v === "none" ? null : v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Sin categoría" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin categoría</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="serviceDescription">Descripción</Label>
              <Textarea
                id="serviceDescription"
                rows={3}
                value={values.description}
                onChange={(e) => patch("description", e.target.value)}
              />
            </div>
          </div>
        </form>

        <SheetFooter>
          <Button type="submit" onClick={handleSubmit} disabled={saving || uploading}>
            {saving ? "Guardando..." : isEdit ? "Guardar cambios" : "Crear servicio"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

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
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
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
  updateServicePackageAction,
  type ServiceInput,
} from "@/app/(app)/servicios/actions";
import { uploadCompanyFile } from "@/lib/storage";
import type { Service, ServiceCategory, ServicePackageItem } from "@/types/database";

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
  otherServices = [],
  packageItems = [],
}: {
  companyId: string;
  categories: ServiceCategory[];
  service?: Service;
  otherServices?: Service[];
  packageItems?: ServicePackageItem[];
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
  const [isPackage, setIsPackage] = React.useState(service?.is_package ?? false);
  const [componentIds, setComponentIds] = React.useState(
    new Set(packageItems.map((item) => item.component_service_id)),
  );

  const availableComponents = otherServices.filter(
    (s) => s.status === "active" && !s.is_package,
  );

  function toggleComponent(id: string, checked: boolean) {
    setComponentIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

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

    if ("error" in result) {
      setSaving(false);
      setErrors(result.fieldErrors ?? {});
      toast.error(result.error);
      return;
    }

    if (isEdit) {
      const packageResult = await updateServicePackageAction(
        service!.id,
        isPackage,
        Array.from(componentIds),
      );
      setSaving(false);
      if ("error" in packageResult) {
        toast.error(packageResult.error);
        return;
      }
    } else {
      setSaving(false);
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

          <div className="space-y-3">
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Paquete de servicios
            </p>
            {isEdit ? (
              <>
                <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
                  <div className="pr-3">
                    <p className="text-sm font-medium text-foreground">Es un paquete de varios servicios</p>
                    <p className="text-xs text-muted-foreground">
                      Se cobra a un precio combinado y agrupa otros servicios existentes.
                    </p>
                  </div>
                  <Switch checked={isPackage} onCheckedChange={setIsPackage} />
                </div>
                {isPackage && (
                  <div className="space-y-2.5">
                    {availableComponents.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No tienes otros servicios activos para incluir en el paquete.
                      </p>
                    ) : (
                      availableComponents.map((s) => {
                        const checked = componentIds.has(s.id);
                        return (
                          <div key={s.id} className="flex items-center gap-2.5">
                            <Checkbox
                              id={`package-component-${s.id}`}
                              checked={checked}
                              onCheckedChange={(value) => toggleComponent(s.id, value === true)}
                            />
                            <Label
                              htmlFor={`package-component-${s.id}`}
                              className="cursor-pointer font-normal"
                            >
                              {s.name}
                            </Label>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Guarda el servicio primero para armar el paquete.
              </p>
            )}
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

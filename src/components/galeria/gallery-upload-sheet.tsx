"use client";

import * as React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ImagePlus, X, Images } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { createGalleryItemAction, type GalleryItemInput } from "@/app/(app)/galeria/actions";
import { uploadCompanyFile } from "@/lib/storage";
import type { Professional, Service } from "@/types/database";

const EMPTY: GalleryItemInput = {
  imageUrl: "",
  serviceId: null,
  professionalId: null,
  description: "",
};

export function GalleryUploadSheet({
  companyId,
  services,
  professionals,
}: {
  companyId: string;
  services: Service[];
  professionals: Professional[];
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [values, setValues] = React.useState<GalleryItemInput>(EMPTY);
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);

  function patch<K extends keyof GalleryItemInput>(key: K, value: GalleryItemInput[K]) {
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
    if (!values.imageUrl) {
      setError("Sube una imagen para continuar.");
      return;
    }
    setSaving(true);
    setError(null);

    const result = await createGalleryItemAction(values);
    setSaving(false);

    if ("error" in result) {
      setError(result.error);
      toast.error(result.error);
      return;
    }

    toast.success("Foto agregada a la galería.");
    setOpen(false);
    setValues(EMPTY);
    router.refresh();
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setValues(EMPTY);
          setError(null);
        }
      }}
    >
      <SheetTrigger asChild>
        <Button>
          <Images /> Subir foto
        </Button>
      </SheetTrigger>
      <SheetContent className="overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Nueva foto</SheetTitle>
          <SheetDescription>
            Agrega una foto de un trabajo terminado a tu galería.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col gap-5 overflow-y-auto px-4">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-muted">
                {values.imageUrl ? (
                  <Image src={values.imageUrl} alt="" width={64} height={64} className="size-full object-cover" />
                ) : (
                  <ImagePlus className="size-5 text-muted-foreground" />
                )}
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="galleryImage" className="cursor-pointer text-sm font-medium text-brand">
                  {uploading ? "Subiendo..." : values.imageUrl ? "Cambiar imagen" : "Subir imagen"}
                </Label>
                <input
                  id="galleryImage"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={uploading}
                  onChange={handleImageChange}
                />
                {values.imageUrl && (
                  <button
                    type="button"
                    onClick={() => patch("imageUrl", "")}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <X className="size-4" />
                  </button>
                )}
              </div>
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}

            <div className="space-y-1.5">
              <Label>Servicio (opcional)</Label>
              <Select
                value={values.serviceId ?? "none"}
                onValueChange={(v) => patch("serviceId", v === "none" ? null : v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Ninguno" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Ninguno</SelectItem>
                  {services.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Profesional (opcional)</Label>
              <Select
                value={values.professionalId ?? "none"}
                onValueChange={(v) => patch("professionalId", v === "none" ? null : v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Ninguno" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Ninguno</SelectItem>
                  {professionals.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="galleryDescription">Descripción</Label>
              <Textarea
                id="galleryDescription"
                rows={3}
                value={values.description}
                onChange={(e) => patch("description", e.target.value)}
              />
            </div>
          </div>
        </form>

        <SheetFooter>
          <Button type="submit" onClick={handleSubmit} disabled={saving || uploading}>
            {saving ? "Guardando..." : "Agregar a la galería"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

"use client";

import * as React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Scissors, Pencil, ImagePlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  createProfessionalAction,
  updateProfessionalAction,
  type ProfessionalInput,
} from "@/app/(app)/profesionales/actions";
import { uploadCompanyFile } from "@/lib/storage";
import { WORK_DAY_LABELS } from "@/lib/professionals";
import { cn } from "@/lib/utils";
import type { StaffTerms } from "@/lib/staff-terms";
import { capitalize } from "@/lib/staff-terms";
import type { Professional } from "@/types/database";

const EMPTY: ProfessionalInput = {
  name: "",
  photoUrl: null,
  specialty: "",
  workDays: [1, 2, 3, 4, 5, 6],
  workStartTime: "09:00",
  workEndTime: "18:00",
};

export function ProfessionalFormSheet({
  companyId,
  professional,
  terms,
}: {
  companyId: string;
  professional?: Professional;
  terms: StaffTerms;
}) {
  const router = useRouter();
  const isEdit = Boolean(professional);
  const [open, setOpen] = React.useState(false);
  const [values, setValues] = React.useState<ProfessionalInput>(
    professional
      ? {
          name: professional.name,
          photoUrl: professional.photo_url,
          specialty: professional.specialty ?? "",
          workDays: professional.work_days,
          workStartTime: professional.work_start_time.slice(0, 5),
          workEndTime: professional.work_end_time.slice(0, 5),
        }
      : EMPTY,
  );
  const [errors, setErrors] = React.useState<Partial<Record<"name" | "workDays", string>>>({});
  const [saving, setSaving] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);

  function patch<K extends keyof ProfessionalInput>(key: K, value: ProfessionalInput[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  function toggleDay(day: number) {
    setValues((v) => ({
      ...v,
      workDays: v.workDays.includes(day)
        ? v.workDays.filter((d) => d !== day)
        : [...v.workDays, day].sort((a, b) => a - b),
    }));
  }

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadCompanyFile("logos", companyId, file);
      patch("photoUrl", url);
    } catch {
      toast.error("No pudimos subir la foto.");
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErrors({});

    const result = isEdit
      ? await updateProfessionalAction(professional!.id, values)
      : await createProfessionalAction(values);
    setSaving(false);

    if ("error" in result) {
      setErrors(result.fieldErrors ?? {});
      toast.error(result.error);
      return;
    }

    toast.success(
      isEdit ? `${capitalize(terms.singular)} actualizado.` : `${capitalize(terms.singular)} creado correctamente.`,
    );
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
            <Scissors /> {terms.newLabel}
          </Button>
        )}
      </SheetTrigger>
      <SheetContent className="overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{isEdit ? `Editar ${terms.singular}` : terms.newLabel}</SheetTitle>
          <SheetDescription>
            {isEdit
              ? `Actualiza la información d${terms.theSingular.slice(1)}.`
              : `Agrega un ${terms.singular} a tu equipo.`}
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col gap-5 overflow-y-auto px-4">
          <div className="space-y-3">
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Información principal
            </p>

            <div className="flex items-center gap-3">
              <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-muted">
                {values.photoUrl ? (
                  <Image src={values.photoUrl} alt="" width={64} height={64} className="size-full object-cover" />
                ) : (
                  <ImagePlus className="size-5 text-muted-foreground" />
                )}
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="professionalPhoto" className="cursor-pointer text-sm font-medium text-brand">
                  {uploading ? "Subiendo..." : values.photoUrl ? "Cambiar foto" : "Subir foto"}
                </Label>
                <input
                  id="professionalPhoto"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={uploading}
                  onChange={handlePhotoChange}
                />
                {values.photoUrl && (
                  <button
                    type="button"
                    onClick={() => patch("photoUrl", null)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <X className="size-4" />
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="professionalName">Nombre</Label>
              <Input
                id="professionalName"
                autoFocus
                value={values.name}
                onChange={(e) => patch("name", e.target.value)}
                aria-invalid={Boolean(errors.name)}
              />
              {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="professionalSpecialty">Especialidad</Label>
              <Input
                id="professionalSpecialty"
                value={values.specialty}
                onChange={(e) => patch("specialty", e.target.value)}
                placeholder="Ej. Cortes, color, barba..."
              />
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Horario de trabajo
            </p>
            <div className="space-y-1.5">
              <Label>Días</Label>
              <div className="flex flex-wrap gap-1.5">
                {WORK_DAY_LABELS.map((label, day) => {
                  const checked = values.workDays.includes(day);
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => toggleDay(day)}
                      className={cn(
                        "flex size-9 items-center justify-center rounded-full border text-xs font-medium transition-colors",
                        checked
                          ? "border-brand bg-brand text-brand-foreground"
                          : "border-border bg-background text-muted-foreground",
                      )}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
              {errors.workDays && <p className="text-xs text-destructive">{errors.workDays}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="professionalStart">Hora de inicio</Label>
                <Input
                  id="professionalStart"
                  type="time"
                  value={values.workStartTime}
                  onChange={(e) => patch("workStartTime", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="professionalEnd">Hora de fin</Label>
                <Input
                  id="professionalEnd"
                  type="time"
                  value={values.workEndTime}
                  onChange={(e) => patch("workEndTime", e.target.value)}
                />
              </div>
            </div>
          </div>
        </form>

        <SheetFooter>
          <Button type="submit" onClick={handleSubmit} disabled={saving || uploading}>
            {saving ? "Guardando..." : isEdit ? "Guardar cambios" : `Crear ${terms.singular}`}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PawPrint, Pencil } from "lucide-react";
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
import { CustomerCombobox } from "@/components/ventas/customer-combobox";
import { createPetAction, updatePetAction, type PetInput } from "@/app/(app)/mascotas/actions";
import type { Customer, Pet } from "@/types/database";

const EMPTY: PetInput = {
  customerId: "",
  name: "",
  species: "",
  breed: "",
  sex: "",
  birthDate: "",
  notes: "",
};

export function PetFormSheet({ pet, customers }: { pet?: Pet; customers: Customer[] }) {
  const router = useRouter();
  const isEdit = Boolean(pet);
  const [open, setOpen] = React.useState(false);
  const [values, setValues] = React.useState<PetInput>(
    pet
      ? {
          customerId: pet.customer_id,
          name: pet.name,
          species: pet.species ?? "",
          breed: pet.breed ?? "",
          sex: pet.sex ?? "",
          birthDate: pet.birth_date ?? "",
          notes: pet.notes ?? "",
        }
      : EMPTY,
  );
  const [errors, setErrors] = React.useState<Partial<Record<keyof PetInput, string>>>({});
  const [saving, setSaving] = React.useState(false);

  function patch<K extends keyof PetInput>(key: K, value: PetInput[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErrors({});

    const result = isEdit
      ? await updatePetAction(pet!.id, values)
      : await createPetAction(values);
    setSaving(false);

    if ("error" in result) {
      setErrors(result.fieldErrors ?? {});
      toast.error(result.error);
      return;
    }

    toast.success(isEdit ? "Mascota actualizada." : "Mascota creada correctamente.");
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
            <PawPrint /> Nueva mascota
          </Button>
        )}
      </SheetTrigger>
      <SheetContent className="overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{isEdit ? "Editar mascota" : "Nueva mascota"}</SheetTitle>
          <SheetDescription>
            {isEdit ? "Actualiza la información de la mascota." : "Registra una mascota de tu cliente."}
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col gap-5 overflow-y-auto px-4">
          <div className="space-y-3">
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Información principal
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="customerId">Dueño</Label>
              <CustomerCombobox
                customers={customers}
                value={values.customerId}
                onChange={(v) => patch("customerId", v)}
              />
              {errors.customerId && (
                <p className="text-xs text-destructive">{errors.customerId}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="name">Nombre</Label>
              <Input
                id="name"
                value={values.name}
                onChange={(e) => patch("name", e.target.value)}
                aria-invalid={Boolean(errors.name)}
              />
              {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="species">Especie</Label>
                <Input
                  id="species"
                  value={values.species}
                  onChange={(e) => patch("species", e.target.value)}
                  placeholder="Perro, Gato..."
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="breed">Raza</Label>
                <Input
                  id="breed"
                  value={values.breed}
                  onChange={(e) => patch("breed", e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Información adicional
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="sex">Sexo</Label>
                <Select value={values.sex} onValueChange={(v) => patch("sex", v)}>
                  <SelectTrigger id="sex" className="w-full">
                    <SelectValue placeholder="No especifica" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Macho</SelectItem>
                    <SelectItem value="female">Hembra</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="birthDate">Fecha de nacimiento</Label>
                <Input
                  id="birthDate"
                  type="date"
                  value={values.birthDate}
                  onChange={(e) => patch("birthDate", e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="notes">Notas</Label>
              <Textarea
                id="notes"
                rows={3}
                value={values.notes}
                onChange={(e) => patch("notes", e.target.value)}
                placeholder="Alergias, cuidados especiales, referencias..."
              />
            </div>
          </div>
        </form>

        <SheetFooter>
          <Button type="submit" onClick={handleSubmit} disabled={saving}>
            {saving ? "Guardando..." : isEdit ? "Guardar cambios" : "Crear mascota"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

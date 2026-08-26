"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { UserPlus, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  createCustomerAction,
  updateCustomerAction,
  type CustomerInput,
} from "@/app/(app)/clientes/actions";
import type { Customer } from "@/types/database";

const EMPTY: CustomerInput = {
  firstName: "",
  lastName: "",
  phone: "",
  email: "",
  address: "",
  city: "",
  notes: "",
};

export function CustomerFormSheet({ customer }: { customer?: Customer }) {
  const router = useRouter();
  const isEdit = Boolean(customer);
  const [open, setOpen] = React.useState(false);
  const [values, setValues] = React.useState<CustomerInput>(
    customer
      ? {
          firstName: customer.first_name,
          lastName: customer.last_name ?? "",
          phone: customer.phone ?? "",
          email: customer.email ?? "",
          address: customer.address ?? "",
          city: customer.city ?? "",
          notes: customer.notes ?? "",
        }
      : EMPTY,
  );
  const [errors, setErrors] = React.useState<Partial<Record<keyof CustomerInput, string>>>({});
  const [saving, setSaving] = React.useState(false);

  function patch<K extends keyof CustomerInput>(key: K, value: CustomerInput[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErrors({});

    const result = isEdit
      ? await updateCustomerAction(customer!.id, values)
      : await createCustomerAction(values);
    setSaving(false);

    if ("error" in result) {
      setErrors(result.fieldErrors ?? {});
      toast.error(result.error);
      return;
    }

    toast.success(isEdit ? "Cliente actualizado." : "Cliente creado correctamente.");
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
            <UserPlus /> Nuevo cliente
          </Button>
        )}
      </SheetTrigger>
      <SheetContent className="overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{isEdit ? "Editar cliente" : "Nuevo cliente"}</SheetTitle>
          <SheetDescription>
            {isEdit ? "Actualiza la información del cliente." : "Agrega un cliente a tu negocio."}
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col gap-5 overflow-y-auto px-4">
          <div className="space-y-3">
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Información principal
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="firstName">Nombre</Label>
                <Input
                  id="firstName"
                  autoFocus
                  value={values.firstName}
                  onChange={(e) => patch("firstName", e.target.value)}
                  aria-invalid={Boolean(errors.firstName)}
                />
                {errors.firstName && (
                  <p className="text-xs text-destructive">{errors.firstName}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lastName">Apellido</Label>
                <Input
                  id="lastName"
                  value={values.lastName}
                  onChange={(e) => patch("lastName", e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">Teléfono</Label>
              <Input
                id="phone"
                value={values.phone}
                onChange={(e) => patch("phone", e.target.value)}
                placeholder="300 123 4567"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Correo</Label>
              <Input
                id="email"
                type="email"
                value={values.email}
                onChange={(e) => patch("email", e.target.value)}
                aria-invalid={Boolean(errors.email)}
              />
              {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Información adicional
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="city">Ciudad</Label>
                <Input
                  id="city"
                  value={values.city}
                  onChange={(e) => patch("city", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="address">Dirección</Label>
                <Input
                  id="address"
                  value={values.address}
                  onChange={(e) => patch("address", e.target.value)}
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
                placeholder="Preferencias, alergias, referencias..."
              />
            </div>
          </div>
        </form>

        <SheetFooter>
          <Button type="submit" onClick={handleSubmit} disabled={saving}>
            {saving ? "Guardando..." : isEdit ? "Guardar cambios" : "Crear cliente"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

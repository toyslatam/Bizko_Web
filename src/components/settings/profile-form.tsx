"use client";

import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateProfileAction } from "@/app/(app)/configuracion/profile-actions";
import type { Profile } from "@/types/database";

export function ProfileForm({ profile }: { profile: Profile }) {
  const [values, setValues] = React.useState({
    firstName: profile.first_name ?? "",
    lastName: profile.last_name ?? "",
    phone: profile.phone ?? "",
  });
  const [saving, setSaving] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const result = await updateProfileAction(values);
    setSaving(false);

    if ("error" in result) {
      toast.error("No pudimos guardar tu perfil", { description: result.error });
      return;
    }
    toast.success("Tu perfil fue actualizado correctamente.");
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-md space-y-6 py-2">
      <div className="space-y-2">
        <Label htmlFor="profileEmail">Correo</Label>
        <Input id="profileEmail" value={profile.email} disabled />
        <p className="text-xs text-muted-foreground">
          Para cambiar tu correo, contacta a soporte.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-5">
        <div className="space-y-2">
          <Label htmlFor="firstName">Nombre</Label>
          <Input
            id="firstName"
            value={values.firstName}
            onChange={(e) => setValues((v) => ({ ...v, firstName: e.target.value }))}
            placeholder="Sofía"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="lastName">Apellido</Label>
          <Input
            id="lastName"
            value={values.lastName}
            onChange={(e) => setValues((v) => ({ ...v, lastName: e.target.value }))}
            placeholder="Ramírez"
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="profilePhone">Teléfono</Label>
        <Input
          id="profilePhone"
          value={values.phone}
          onChange={(e) => setValues((v) => ({ ...v, phone: e.target.value }))}
          placeholder="300 123 4567"
        />
      </div>
      <Button type="submit" disabled={saving} className="mt-1">
        {saving ? "Guardando..." : "Guardar cambios"}
      </Button>
    </form>
  );
}

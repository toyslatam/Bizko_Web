"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/lib/auth/session";

export interface VehicleInput {
  customerId: string;
  plate: string;
  brand: string;
  model: string;
  color: string;
  notes: string;
}

type ActionResult =
  | { ok: true; id: string }
  | { error: string; fieldErrors?: Partial<Record<keyof VehicleInput, string>> };

function validate(input: VehicleInput): Partial<Record<keyof VehicleInput, string>> {
  const errors: Partial<Record<keyof VehicleInput, string>> = {};
  if (!input.customerId.trim()) errors.customerId = "Selecciona un cliente.";
  if (!input.plate.trim()) errors.plate = "La placa es obligatoria.";
  return errors;
}

export async function createVehicleAction(input: VehicleInput): Promise<ActionResult> {
  const fieldErrors = validate(input);
  if (Object.keys(fieldErrors).length > 0) return { error: "Revisa los campos.", fieldErrors };

  const session = await getSessionContext();
  if (!session?.activeCompany) return { error: "No encontramos tu negocio activo." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("vehicles")
    .insert({
      company_id: session.activeCompany.id,
      customer_id: input.customerId,
      plate: input.plate.trim().toUpperCase(),
      brand: input.brand.trim() || null,
      model: input.model.trim() || null,
      color: input.color.trim() || null,
      notes: input.notes.trim() || null,
    })
    .select("id")
    .single();

  if (error || !data) return { error: "No pudimos crear el vehículo." };

  revalidatePath("/vehiculos");
  return { ok: true, id: data.id };
}

export async function updateVehicleAction(
  id: string,
  input: VehicleInput,
): Promise<ActionResult> {
  const fieldErrors = validate(input);
  if (Object.keys(fieldErrors).length > 0) return { error: "Revisa los campos.", fieldErrors };

  const supabase = await createClient();
  const { error } = await supabase
    .from("vehicles")
    .update({
      customer_id: input.customerId,
      plate: input.plate.trim().toUpperCase(),
      brand: input.brand.trim() || null,
      model: input.model.trim() || null,
      color: input.color.trim() || null,
      notes: input.notes.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) return { error: "No pudimos guardar los cambios." };

  revalidatePath("/vehiculos");
  revalidatePath(`/vehiculos/${id}`);
  return { ok: true, id };
}

export async function deleteVehicleAction(
  id: string,
): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from("vehicles").delete().eq("id", id);

  if (error) return { error: "No pudimos eliminar el vehículo." };

  revalidatePath("/vehiculos");
  revalidatePath(`/vehiculos/${id}`);
  return { ok: true };
}

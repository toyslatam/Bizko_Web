"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/lib/auth/session";

export interface PetInput {
  customerId: string;
  name: string;
  species: string;
  breed: string;
  sex: string;
  birthDate: string;
  notes: string;
}

type ActionResult =
  | { ok: true; id: string }
  | { error: string; fieldErrors?: Partial<Record<keyof PetInput, string>> };

function validate(input: PetInput): Partial<Record<keyof PetInput, string>> {
  const errors: Partial<Record<keyof PetInput, string>> = {};
  if (!input.customerId) errors.customerId = "Selecciona un dueño.";
  if (!input.name.trim()) errors.name = "El nombre es obligatorio.";
  return errors;
}

export async function createPetAction(input: PetInput): Promise<ActionResult> {
  const fieldErrors = validate(input);
  if (Object.keys(fieldErrors).length > 0) return { error: "Revisa los campos.", fieldErrors };

  const session = await getSessionContext();
  if (!session?.activeCompany) return { error: "No encontramos tu negocio activo." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pets")
    .insert({
      company_id: session.activeCompany.id,
      customer_id: input.customerId,
      name: input.name.trim(),
      species: input.species.trim() || null,
      breed: input.breed.trim() || null,
      sex: input.sex.trim() || null,
      birth_date: input.birthDate || null,
      notes: input.notes.trim() || null,
    })
    .select("id")
    .single();

  if (error || !data) return { error: "No pudimos crear la mascota." };

  revalidatePath("/mascotas");
  return { ok: true, id: data.id };
}

export async function updatePetAction(id: string, input: PetInput): Promise<ActionResult> {
  const fieldErrors = validate(input);
  if (Object.keys(fieldErrors).length > 0) return { error: "Revisa los campos.", fieldErrors };

  const supabase = await createClient();
  const { error } = await supabase
    .from("pets")
    .update({
      customer_id: input.customerId,
      name: input.name.trim(),
      species: input.species.trim() || null,
      breed: input.breed.trim() || null,
      sex: input.sex.trim() || null,
      birth_date: input.birthDate || null,
      notes: input.notes.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) return { error: "No pudimos guardar los cambios." };

  revalidatePath("/mascotas");
  revalidatePath(`/mascotas/${id}`);
  return { ok: true, id };
}

export async function deletePetAction(id: string): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from("pets").delete().eq("id", id);

  if (error) return { error: "No pudimos eliminar la mascota." };

  revalidatePath("/mascotas");
  return { ok: true };
}

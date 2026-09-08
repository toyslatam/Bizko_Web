"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/lib/auth/session";

export interface GalleryItemInput {
  imageUrl: string;
  serviceId: string | null;
  professionalId: string | null;
  description: string;
}

type ActionResult = { ok: true; id: string } | { error: string };

export async function createGalleryItemAction(
  input: GalleryItemInput,
): Promise<ActionResult> {
  if (!input.imageUrl.trim()) return { error: "La imagen es obligatoria." };

  const session = await getSessionContext();
  if (!session?.activeCompany) return { error: "No encontramos tu negocio activo." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("work_gallery")
    .insert({
      company_id: session.activeCompany.id,
      image_url: input.imageUrl,
      service_id: input.serviceId,
      professional_id: input.professionalId,
      description: input.description.trim() || null,
    })
    .select("id")
    .single();

  if (error || !data) return { error: "No pudimos guardar la imagen." };

  revalidatePath("/galeria");
  return { ok: true, id: data.id };
}

export async function deleteGalleryItemAction(
  id: string,
): Promise<{ ok: true } | { error: string }> {
  const session = await getSessionContext();
  if (!session?.activeCompany) return { error: "No encontramos tu negocio activo." };

  const supabase = await createClient();
  const { error } = await supabase.from("work_gallery").delete().eq("id", id);

  if (error) return { error: "No pudimos eliminar la imagen." };

  revalidatePath("/galeria");
  return { ok: true };
}

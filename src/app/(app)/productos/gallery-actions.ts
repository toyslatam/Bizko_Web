"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type ActionResult<T extends object = object> = ({ ok: true } & T) | { error: string };

export async function addGalleryImageAction(
  productId: string,
  imageUrl: string,
): Promise<ActionResult<{ id: string }>> {
  const supabase = await createClient();

  const { count } = await supabase
    .from("product_images")
    .select("id", { count: "exact", head: true })
    .eq("product_id", productId);

  const { data, error } = await supabase
    .from("product_images")
    .insert({ product_id: productId, image_url: imageUrl, sort_order: count ?? 0 })
    .select("id")
    .single();

  if (error || !data) return { error: "No pudimos agregar la foto." };

  revalidatePath(`/productos/${productId}`);
  return { ok: true, id: data.id };
}

export async function removeGalleryImageAction(imageId: string, productId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("product_images").delete().eq("id", imageId);

  if (error) return { error: "No pudimos quitar la foto." };

  revalidatePath(`/productos/${productId}`);
  return { ok: true };
}

export async function reorderGalleryImagesAction(
  productId: string,
  orderedImageIds: string[],
): Promise<ActionResult> {
  const supabase = await createClient();

  for (let i = 0; i < orderedImageIds.length; i++) {
    const { error } = await supabase
      .from("product_images")
      .update({ sort_order: i })
      .eq("id", orderedImageIds[i]);
    if (error) return { error: "No pudimos reordenar las fotos." };
  }

  revalidatePath(`/productos/${productId}`);
  return { ok: true };
}

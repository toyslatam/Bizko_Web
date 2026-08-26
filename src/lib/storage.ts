import { createClient } from "@/lib/supabase/client";

export type StorageBucket = "logos" | "product-images" | "documents";

const IMAGE_MIME_TYPES = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];
const DOCUMENT_MIME_TYPES = [...IMAGE_MIME_TYPES, "application/pdf"];

// Debe coincidir con los límites configurados en storage.buckets
// (supabase/migrations/0017_production_hardening.sql) — se valida también
// aquí para dar un mensaje claro antes de intentar la subida, no solo
// después de que Supabase la rechace.
const BUCKET_RULES: Record<StorageBucket, { maxBytes: number; mimeTypes: string[] }> = {
  logos: { maxBytes: 5 * 1024 * 1024, mimeTypes: IMAGE_MIME_TYPES },
  "product-images": { maxBytes: 5 * 1024 * 1024, mimeTypes: IMAGE_MIME_TYPES },
  documents: { maxBytes: 15 * 1024 * 1024, mimeTypes: DOCUMENT_MIME_TYPES },
};

/** Nombre de archivo seguro para usar como parte de la ruta en Storage. */
function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-100);
}

/**
 * Sube un archivo respetando la convención `<bucket>/<company_id>/<archivo>`
 * que exigen las políticas de Storage en supabase/migrations/0002_storage.sql.
 */
export async function uploadCompanyFile(
  bucket: StorageBucket,
  companyId: string,
  file: File,
) {
  const rules = BUCKET_RULES[bucket];
  if (!rules.mimeTypes.includes(file.type)) {
    throw new Error("Formato de archivo no permitido.");
  }
  if (file.size > rules.maxBytes) {
    throw new Error(`El archivo supera el tamaño máximo permitido (${Math.round(rules.maxBytes / 1024 / 1024)} MB).`);
  }

  const supabase = createClient();
  const path = `${companyId}/${Date.now()}-${sanitizeFileName(file.name)}`;

  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  });
  if (error) throw error;

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

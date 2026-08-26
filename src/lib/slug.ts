/** "Panadería El Trigal" -> "panaderia-el-trigal" (+ sufijo corto si hace falta). */
export function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function slugWithSuffix(value: string): string {
  const base = slugify(value) || "negocio";
  const suffix = Math.random().toString(36).slice(2, 6);
  return `${base}-${suffix}`;
}

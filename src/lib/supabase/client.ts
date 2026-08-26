import { createBrowserClient } from "@supabase/ssr";

/**
 * Cliente de Supabase para uso en componentes de cliente ("use client").
 * Lee la URL y la anon key de variables de entorno para poder apuntar,
 * sin cambios de código, a un proyecto Supabase Cloud o a una instancia
 * Supabase self-hosted en un VPS.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

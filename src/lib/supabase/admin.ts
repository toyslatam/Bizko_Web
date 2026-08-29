import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Cliente con el service role de Supabase — se salta RLS, así que SOLO se
 * usa para operaciones que Postgres no puede hacer con el rol `authenticated`
 * (ej. crear un usuario de Auth para invitarlo por correo). Nunca importar
 * este archivo desde un componente de cliente; "server-only" lo garantiza.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) return null;

  return createSupabaseClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

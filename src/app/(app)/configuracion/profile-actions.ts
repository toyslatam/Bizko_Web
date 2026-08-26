"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function updateProfileAction(input: {
  firstName: string;
  lastName: string;
  phone: string;
}): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Tu sesión expiró. Inicia sesión nuevamente." };

  // upsert: cubre tanto perfiles ya creados por el trigger on_auth_user_created
  // como cuentas creadas antes de que ese trigger existiera (sin fila todavía).
  const { error } = await supabase.from("profiles").upsert({
    id: user.id,
    email: user.email!,
    first_name: input.firstName || null,
    last_name: input.lastName || null,
    phone: input.phone || null,
    updated_at: new Date().toISOString(),
  });

  if (error) return { error: "No pudimos guardar tu perfil." };

  revalidatePath("/configuracion");
  revalidatePath("/dashboard");
  return { ok: true };
}

"use client";

import * as React from "react";

/**
 * Si un link de correo de Supabase (invitación, recuperar contraseña) cae
 * aquí en vez de /actualizar-password — porque la URL de redirección
 * configurada en Supabase no coincide exacto con la ruta — el token de
 * sesión viene en el hash de la URL y nadie lo procesa. Este guard lo
 * detecta y redirige antes de que se vea la portada de marketing.
 */
export function AuthTokenRedirect() {
  React.useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes("access_token")) {
      window.location.replace(`/actualizar-password${hash}`);
    } else if (hash.includes("error=")) {
      window.location.replace("/login?linkExpired=1");
    }
  }, []);

  return null;
}

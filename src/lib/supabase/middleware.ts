import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/registro", "/recuperar", "/actualizar-password", "/store"];
// /login se excluye a propósito: un usuario ya autenticado debe poder abrir
// /login para iniciar sesión con OTRA cuenta (ej. su cuenta de negocio vs.
// su cuenta de Super Admin) sin tener que cerrar sesión primero. /registro
// y /recuperar sí no tienen sentido para alguien que ya tiene una sesión.
const AUTH_PATHS = ["/registro", "/recuperar"];

function isPublicPath(pathname: string) {
  return (
    pathname === "/" ||
    PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))
  );
}

/**
 * Refresca la sesión de Supabase en cada request y protege las rutas
 * privadas del CORE. Se ejecuta desde middleware.ts en la raíz del proyecto.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Sin Supabase provisionado todavía: dejar pasar (modo demo).
  if (!supabaseUrl || !supabaseAnonKey) {
    return supabaseResponse;
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  if (!user && !isPublicPath(pathname)) {
    const url = request.nextUrl.clone();
    const hadSessionCookie = request.cookies
      .getAll()
      .some((c) => c.name.startsWith("sb-") && c.name.endsWith("-auth-token"));
    url.pathname = "/login";
    url.searchParams.set("redirect", pathname);
    if (hadSessionCookie) url.searchParams.set("expired", "1");
    return NextResponse.redirect(url);
  }

  if (user && AUTH_PATHS.some((p) => pathname.startsWith(p))) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

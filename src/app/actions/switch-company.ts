"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ACTIVE_COMPANY_COOKIE } from "@/lib/auth/session";

/** Cambia la empresa activa (selector de empresa) y refresca el dashboard. */
export async function switchCompanyAction(companyId: string) {
  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_COMPANY_COOKIE, companyId, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  redirect("/dashboard");
}

"use server";

import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { ACTIVE_COMPANY_COOKIE } from "@/lib/auth/session";
import { slugWithSuffix } from "@/lib/slug";
import type { BusinessType, Company } from "@/types/database";

interface CreateCompanyInput {
  name: string;
  businessType: BusinessType;
  phone: string;
  email: string;
  address: string;
  city: string;
}

export async function createCompanyAction(
  input: CreateCompanyInput,
): Promise<{ company: Company } | { error: string }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Tu sesión expiró. Inicia sesión nuevamente." };

  const { data, error } = await supabase
    .rpc("create_company_with_owner", {
      p_name: input.name,
      p_slug: slugWithSuffix(input.name),
      p_business_type: input.businessType,
      p_phone: input.phone || null,
      p_email: input.email || null,
      p_address: input.address || null,
      p_city: input.city || null,
    })
    .single();

  if (error) {
    return { error: "No pudimos crear tu negocio. Intenta de nuevo." };
  }

  const company = data as Company;
  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_COMPANY_COOKIE, company.id, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });

  return { company };
}

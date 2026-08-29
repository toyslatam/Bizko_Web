import "server-only";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ALL_FEATURE_KEYS, type Company, type CompanyMember, type FeatureKey, type Plan, type Profile, type Subscription } from "@/types/database";

export const ACTIVE_COMPANY_COOKIE = "bizko_active_company";

export interface Membership extends CompanyMember {
  company: Company;
}

export interface SessionContext {
  userId: string;
  email: string;
  profile: Profile | null;
  memberships: Membership[];
  /** Empresa activa: la elegida por el usuario (cookie) o la primera. Null si no tiene ninguna. */
  activeCompany: Company | null;
  activeMembership: Membership | null;
  isPlatformAdmin: boolean;
  /** Suscripción y features de la empresa activa (Fase 11) — null si no hay empresa activa. */
  activeSubscription: Subscription | null;
  activePlan: Plan | null;
  /** Features habilitadas por el plan de la empresa activa — nunca confiar en el nombre del plan en el frontend. */
  enabledFeatures: Set<FeatureKey>;
}

/**
 * Carga el contexto completo de sesión en Server Components / layouts:
 * usuario de Supabase Auth, perfil, empresas a las que pertenece y cuál
 * está activa. Devuelve `null` si no hay sesión (el middleware ya debería
 * haber redirigido a /login antes de llegar aquí).
 */
export async function getSessionContext(): Promise<SessionContext | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  // Si esta persona aceptó una invitación (Configuración → Equipo), su
  // membresía nace "invited" — en cuanto llega hasta acá ya tiene una sesión
  // válida de Supabase Auth, así que se activa sola. Sin esto, alguien que
  // acaba de aceptar quedaría sin activeCompany y lo mandaría a /onboarding.
  // RLS de company_members solo deja escribir al OWNER (no a uno mismo), así
  // que esto necesita el service role — si no está configurado (modo demo),
  // simplemente se omite en vez de fallar.
  const admin = createAdminClient();
  if (admin) {
    await admin
      .from("company_members")
      .update({ status: "active" })
      .eq("user_id", user.id)
      .eq("status", "invited");
  }

  const [{ data: profile }, { data: memberships }, { data: adminRow }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    supabase
      .from("company_members")
      .select("*, company:companies(*)")
      .eq("user_id", user.id)
      .eq("status", "active")
      .order("created_at", { ascending: true }),
    supabase.from("platform_admins").select("user_id").eq("user_id", user.id).maybeSingle(),
  ]);

  const typedMemberships = (memberships ?? []) as unknown as Membership[];

  const cookieStore = await cookies();
  const preferredCompanyId = cookieStore.get(ACTIVE_COMPANY_COOKIE)?.value;

  const activeMembership =
    typedMemberships.find((m) => m.company_id === preferredCompanyId) ??
    typedMemberships[0] ??
    null;
  const activeCompanyId = activeMembership?.company_id ?? null;

  let activeSubscription: Subscription | null = null;
  let activePlan: Plan | null = null;
  let enabledFeatures = new Set<FeatureKey>();

  if (activeCompanyId) {
    const [{ data: subscription }, { data: featureRows, error: featuresError }] = await Promise.all([
      supabase
        .from("subscriptions")
        .select("*, plan:plans(*)")
        .eq("company_id", activeCompanyId)
        .maybeSingle(),
      supabase.rpc("get_active_feature_keys", { p_company_id: activeCompanyId }),
    ]);
    const subscriptionRow = subscription as unknown as (Subscription & { plan: Plan }) | null;
    activeSubscription = subscriptionRow ?? null;
    activePlan = subscriptionRow?.plan ?? null;
    // Si la RPC falla (ej. la migración 0013_plans.sql todavía no se corrió en
    // Supabase), no se debe ocultar la navegación entera — se asume acceso
    // completo en vez de fallar cerrado.
    enabledFeatures = featuresError
      ? new Set(ALL_FEATURE_KEYS)
      : new Set(((featureRows as { feature_key: FeatureKey }[] | null) ?? []).map((r) => r.feature_key));
  }

  return {
    userId: user.id,
    email: user.email ?? "",
    profile: profile ?? null,
    memberships: typedMemberships,
    activeCompany: activeMembership?.company ?? null,
    activeMembership,
    isPlatformAdmin: Boolean(adminRow),
    activeSubscription,
    activePlan,
    enabledFeatures,
  };
}

export function displayName(session: Pick<SessionContext, "profile" | "email">): string {
  const first = session.profile?.first_name?.trim();
  const last = session.profile?.last_name?.trim();
  if (first || last) return [first, last].filter(Boolean).join(" ");
  return session.email.split("@")[0];
}

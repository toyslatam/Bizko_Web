import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/lib/auth/session";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CompanySettingsForm } from "@/components/settings/company-settings-form";
import { TeamPanel } from "@/components/settings/team-panel";
import { ProfileForm } from "@/components/settings/profile-form";
import { DeliverySettingsForm } from "@/components/settings/delivery-settings-form";
import { PlanSubscriptionPanel } from "@/components/settings/plan-subscription-panel";
import type { CompanyMember, FeatureKey, Plan, PlanUsageRow, Profile } from "@/types/database";

interface PlanWithFeatures extends Plan {
  plan_features: { enabled: boolean; feature_key: FeatureKey; feature: { name: string; description: string | null } | null }[];
  plan_limits: { limit_key: PlanUsageRow["limit_key"]; limit_value: number | null }[];
}

export default async function ConfiguracionPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await getSessionContext();
  if (!session) redirect("/login");
  if (!session.activeCompany) redirect("/onboarding");

  const { tab } = await searchParams;
  const supabase = await createClient();
  const companyId = session.activeCompany.id;

  const [{ data: members }, { data: plansData }, { data: usageData }] = await Promise.all([
    supabase
      .from("company_members")
      .select("*, profile:profiles(*)")
      .eq("company_id", companyId)
      .order("created_at", { ascending: true }),
    supabase
      .from("plans")
      .select(
        "*, plan_features(enabled, feature_key, feature:features(name, description)), plan_limits(limit_key, limit_value)",
      )
      .eq("is_active", true)
      .order("price_monthly_cents", { ascending: true }),
    supabase.rpc("get_plan_usage", { p_company_id: companyId }),
  ]);

  const team = (members ?? []) as unknown as (CompanyMember & { profile: Profile | null })[];
  const plans = (plansData ?? []) as unknown as PlanWithFeatures[];
  const usage = (usageData as PlanUsageRow[] | null) ?? [];
  const isOwner = session.activeMembership?.role === "owner";

  return (
    <div>
      <PageHeader
        title="Configuración"
        description="Ajusta la información y el equipo de tu negocio."
      />

      <Tabs defaultValue={tab === "plan" ? "plan" : "perfil"}>
        <TabsList>
          <TabsTrigger value="perfil">Mi perfil</TabsTrigger>
          <TabsTrigger value="negocio">Mi negocio</TabsTrigger>
          <TabsTrigger value="delivery">Delivery</TabsTrigger>
          <TabsTrigger value="equipo">Usuarios y equipo</TabsTrigger>
          <TabsTrigger value="plan">Plan y suscripción</TabsTrigger>
        </TabsList>
        <TabsContent value="perfil" className="mt-6">
          <Card>
            <CardContent className="py-2">
              <ProfileForm
                profile={
                  session.profile ?? {
                    id: session.userId,
                    email: session.email,
                    first_name: null,
                    last_name: null,
                    phone: null,
                    avatar_url: null,
                    created_at: "",
                    updated_at: "",
                  }
                }
              />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="negocio" className="mt-6">
          <Card>
            <CardContent className="py-2">
              <CompanySettingsForm company={session.activeCompany} canEdit={isOwner} />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="delivery" className="mt-6">
          <Card>
            <CardContent className="py-2">
              <DeliverySettingsForm company={session.activeCompany} canEdit={isOwner} />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="equipo" className="mt-6">
          <Card>
            <CardContent className="py-2">
              <TeamPanel
                companyId={session.activeCompany.id}
                members={team}
                currentUserId={session.userId}
                canManage={isOwner}
              />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="plan" className="mt-6">
          <PlanSubscriptionPanel
            subscription={session.activeSubscription}
            currentPlan={session.activePlan}
            plans={plans}
            usage={usage}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

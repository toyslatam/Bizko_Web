import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { getSessionContext, displayName } from "@/lib/auth/session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSessionContext();
  if (!session) redirect("/login");
  if (!session.activeCompany) redirect("/onboarding");

  return (
    <AppShell
      companyName={session.activeCompany.name}
      businessType={session.activeCompany.business_type}
      enabledFeatures={[...session.enabledFeatures]}
      subscription={session.activeSubscription}
      plan={session.activePlan}
      userName={displayName(session)}
      userEmail={session.email}
      memberships={session.memberships}
      activeCompanyId={session.activeCompany.id}
      role={session.activeMembership?.role ?? "employee"}
    >
      {children}
    </AppShell>
  );
}

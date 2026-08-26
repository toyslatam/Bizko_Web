import { Sidebar } from "@/components/layout/sidebar";
import { MobileNav } from "@/components/layout/mobile-nav";
import { TopBar } from "@/components/layout/topbar";
import { PlanBanner } from "@/components/layout/plan-banner";
import type { Membership } from "@/lib/auth/session";
import type { BusinessType, CompanyRole, FeatureKey, Plan, Subscription } from "@/types/database";

export function AppShell({
  companyName,
  businessType,
  enabledFeatures,
  subscription,
  plan,
  userName,
  userEmail,
  memberships,
  activeCompanyId,
  role,
  children,
}: {
  companyName: string;
  businessType: BusinessType;
  enabledFeatures: FeatureKey[];
  subscription: Subscription | null;
  plan: Plan | null;
  userName: string;
  userEmail: string;
  memberships: Membership[];
  activeCompanyId: string;
  role: CompanyRole;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh bg-background">
      <Sidebar businessType={businessType} enabledFeatures={enabledFeatures} />
      <div className="flex min-w-0 flex-1 flex-col">
        <PlanBanner subscription={subscription} plan={plan} />
        <TopBar
          companyName={companyName}
          userName={userName}
          userEmail={userEmail}
          memberships={memberships}
          activeCompanyId={activeCompanyId}
          role={role}
        />
        <main className="flex-1 px-4 pt-4 pb-20 md:px-6 md:pb-6">
          {children}
        </main>
      </div>
      <MobileNav businessType={businessType} enabledFeatures={enabledFeatures} />
    </div>
  );
}

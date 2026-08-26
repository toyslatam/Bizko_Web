import { redirect } from "next/navigation";
import { getSessionContext } from "@/lib/auth/session";
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";

export default async function OnboardingPage() {
  const session = await getSessionContext();
  if (!session) redirect("/login");
  if (session.activeCompany) redirect("/dashboard");

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col px-4 py-8 sm:py-12">
      <OnboardingWizard />
    </div>
  );
}

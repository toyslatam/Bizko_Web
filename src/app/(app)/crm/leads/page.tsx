import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/lib/auth/session";
import { PageHeader } from "@/components/ui/page-header";
import { LeadBoard } from "@/components/crm/lead-board";
import { LeadFormSheet } from "@/components/crm/lead-form-sheet";
import { PipelineSettingsDialog } from "@/components/crm/pipeline-settings-dialog";
import type { CrmPipelineStage, Lead } from "@/types/database";

export default async function CrmLeadsPage() {
  const session = await getSessionContext();
  if (!session) redirect("/login");
  if (!session.activeCompany) redirect("/onboarding");

  const supabase = await createClient();
  const companyId = session.activeCompany.id;

  const [{ data: stagesData }, { data: leadsData }] = await Promise.all([
    supabase.rpc("get_or_create_default_pipeline", { p_company_id: companyId }),
    supabase
      .from("leads")
      .select("*")
      .eq("company_id", companyId)
      .order("last_interaction_at", { ascending: false }),
  ]);

  const stages = (stagesData as CrmPipelineStage[]) ?? [];
  const leads = (leadsData as Lead[]) ?? [];

  return (
    <div>
      <PageHeader
        title="Leads"
        description="Pipeline de ventas — de contacto interesado a cliente."
        actions={
          <>
            <PipelineSettingsDialog stages={stages} />
            <LeadFormSheet />
          </>
        }
      />

      <LeadBoard stages={stages} leads={leads} />
    </div>
  );
}

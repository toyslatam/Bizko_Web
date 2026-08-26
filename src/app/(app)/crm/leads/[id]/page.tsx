import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, History, Mail, Phone, Package, DollarSign } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/lib/auth/session";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LeadFormSheet } from "@/components/crm/lead-form-sheet";
import { LeadStageMover } from "@/components/crm/lead-stage-mover";
import { ConvertLeadButton } from "@/components/crm/convert-lead-button";
import { CrmTaskList } from "@/components/crm/crm-task-list";
import { CrmNoteList } from "@/components/crm/crm-note-list";
import { CrmTagPicker } from "@/components/crm/crm-tag-picker";
import { LEAD_SOURCE_LABELS } from "@/lib/crm";
import { formatCurrencyCents } from "@/lib/format";
import type { CrmNote, CrmPipelineStage, CrmTag, CrmTask, Lead, LeadStageHistory } from "@/types/database";

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSessionContext();
  if (!session) redirect("/login");
  if (!session.activeCompany) redirect("/onboarding");

  const { id } = await params;
  const supabase = await createClient();
  const companyId = session.activeCompany.id;

  const { data: leadData } = await supabase.from("leads").select("*").eq("id", id).maybeSingle();
  const lead = leadData as Lead | null;
  if (!lead) notFound();

  const [
    { data: stagesData },
    { data: historyData },
    { data: tasksData },
    { data: notesData },
    { data: tagLinksData },
    { data: companyTagsData },
  ] = await Promise.all([
    supabase.rpc("get_or_create_default_pipeline", { p_company_id: companyId }),
    supabase
      .from("lead_stage_history")
      .select("*, from_stage:crm_pipeline_stages!from_stage_id(name), to_stage:crm_pipeline_stages!to_stage_id(name)")
      .eq("lead_id", id)
      .order("changed_at", { ascending: false }),
    supabase.from("crm_tasks").select("*").eq("lead_id", id),
    supabase.from("crm_notes").select("*").eq("lead_id", id).order("created_at", { ascending: false }),
    supabase.from("crm_tag_links").select("crm_tags(*)").eq("lead_id", id),
    supabase.from("crm_tags").select("*").eq("company_id", companyId).order("name"),
  ]);

  const stages = (stagesData as CrmPipelineStage[]) ?? [];
  const history = (historyData ?? []) as unknown as (LeadStageHistory & {
    from_stage: { name: string } | null;
    to_stage: { name: string } | null;
  })[];
  const tasks = (tasksData as CrmTask[]) ?? [];
  const notes = (notesData as CrmNote[]) ?? [];
  const currentTags = ((tagLinksData ?? []) as unknown as { crm_tags: CrmTag }[])
    .map((row) => row.crm_tags)
    .filter(Boolean);
  const companyTags = (companyTagsData as CrmTag[]) ?? [];

  return (
    <div className="max-w-3xl">
      <Link
        href="/crm/leads"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Leads
      </Link>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-heading text-xl font-semibold text-foreground">{lead.name}</h1>
            <Badge variant="outline">{LEAD_SOURCE_LABELS[lead.source]}</Badge>
          </div>
          {lead.company_name && <p className="text-sm text-muted-foreground">{lead.company_name}</p>}
        </div>
        <div className="flex shrink-0 gap-2">
          <LeadFormSheet lead={lead} />
          <ConvertLeadButton leadId={lead.id} customerId={lead.customer_id} />
        </div>
      </div>

      <div className="mt-6 grid gap-3 rounded-xl border border-border bg-card p-4 sm:grid-cols-2">
        <InfoRow icon={Phone} label="Teléfono" value={lead.phone} />
        <InfoRow icon={Mail} label="Correo" value={lead.email} />
        <InfoRow icon={Package} label="Producto de interés" value={lead.product_interest} />
        <InfoRow
          icon={DollarSign}
          label="Valor potencial"
          value={lead.potential_value_cents != null ? formatCurrencyCents(lead.potential_value_cents) : null}
        />
      </div>

      <div className="mt-4 space-y-1.5">
        <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Etapa</p>
        <LeadStageMover leadId={lead.id} stages={stages} currentStageId={lead.stage_id} />
      </div>

      <div className="mt-6">
        <h2 className="mb-2 font-heading text-base font-semibold text-foreground">Historial de etapas</h2>
        {history.length === 0 ? (
          <EmptyState icon={History} title="Sin historial" description="Los cambios de etapa aparecerán aquí." />
        ) : (
          <ul className="space-y-1.5 text-sm text-muted-foreground">
            {history.map((h) => (
              <li key={h.id} className="flex items-center gap-2">
                <History className="size-3.5 shrink-0" />
                <span>
                  {h.from_stage ? `${h.from_stage.name} → ` : "Creado en "}
                  <span className="font-medium text-foreground">{h.to_stage?.name}</span>
                </span>
                <span className="text-xs">
                  · {new Date(h.changed_at).toLocaleString("es-CO", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-6 grid gap-6">
        <CrmTaskList tasks={tasks} leadId={lead.id} />
        <CrmNoteList notes={notes} owner={{ leadId: lead.id }} />
        <CrmTagPicker currentTags={currentTags} companyTags={companyTags} owner={{ leadId: lead.id }} />
      </div>
    </div>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Phone;
  label: string;
  value: string | null;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm text-foreground">{value || "—"}</p>
      </div>
    </div>
  );
}

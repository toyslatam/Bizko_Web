import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Mail, MapPin, Phone, Receipt, ShoppingCart, ClipboardList, History } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/lib/auth/session";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/ui/empty-state";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/catalog/status-badge";
import { ToggleStatusButton } from "@/components/catalog/toggle-status-button";
import { CustomerFormSheet } from "@/components/clientes/customer-form-sheet";
import { CrmTaskList } from "@/components/crm/crm-task-list";
import { CrmNoteList } from "@/components/crm/crm-note-list";
import { CrmTagPicker } from "@/components/crm/crm-tag-picker";
import { setCustomerStatusAction } from "@/app/(app)/clientes/actions";
import { customerFullName, customerInitials } from "@/lib/catalog";
import { formatCurrencyCents } from "@/lib/format";
import { LEAD_SOURCE_LABELS } from "@/lib/crm";
import type {
  Customer,
  CustomerCrmSummary,
  CrmNote,
  CrmTag,
  CrmTask,
} from "@/types/database";

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSessionContext();
  if (!session) redirect("/login");
  if (!session.activeCompany) redirect("/onboarding");

  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("customers").select("*").eq("id", id).maybeSingle();
  const customer = data as Customer | null;
  if (!customer) notFound();

  const [
    { data: crmSummaryData },
    { data: tasksData },
    { data: notesData },
    { data: tagLinksData },
    { data: companyTagsData },
  ] = await Promise.all([
    supabase.rpc("get_customer_crm_summary", { p_customer_id: id }).single(),
    supabase.from("crm_tasks").select("*").eq("customer_id", id),
    supabase.from("crm_notes").select("*").eq("customer_id", id).order("created_at", { ascending: false }),
    supabase.from("crm_tag_links").select("crm_tags(*)").eq("customer_id", id),
    supabase.from("crm_tags").select("*").eq("company_id", session.activeCompany.id).order("name"),
  ]);

  const crmSummary = crmSummaryData as CustomerCrmSummary | null;
  const crmTasks = (tasksData as CrmTask[]) ?? [];
  const crmNotes = (notesData as CrmNote[]) ?? [];
  const crmCurrentTags = ((tagLinksData ?? []) as unknown as { crm_tags: CrmTag }[])
    .map((row) => row.crm_tags)
    .filter(Boolean);
  const companyTags = (companyTagsData as CrmTag[]) ?? [];

  return (
    <div className="max-w-3xl">
      <Link
        href="/clientes"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Clientes
      </Link>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Avatar className="size-12">
            <AvatarFallback className="bg-brand/15 text-sm font-semibold text-brand">
              {customerInitials(customer)}
            </AvatarFallback>
          </Avatar>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-heading text-xl font-semibold text-foreground">
                {customerFullName(customer)}
              </h1>
              <StatusBadge status={customer.status} />
              {customer.source && (
                <Badge variant="outline">{LEAD_SOURCE_LABELS[customer.source]}</Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              Cliente desde {new Date(customer.created_at).toLocaleDateString("es-CO", {
                month: "long",
                year: "numeric",
              })}
            </p>
            {customer.converted_from_lead_id && (
              <Link
                href={`/crm/leads/${customer.converted_from_lead_id}`}
                className="mt-0.5 inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline"
              >
                Viene del lead
              </Link>
            )}
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <CustomerFormSheet customer={customer} />
          <ToggleStatusButton
            status={customer.status}
            entityLabel="Cliente"
            onToggle={setCustomerStatusAction.bind(null, customer.id)}
          />
        </div>
      </div>

      <div className="mt-6 grid gap-3 rounded-xl border border-border bg-card p-4 sm:grid-cols-2">
        <InfoRow icon={Phone} label="Teléfono" value={customer.phone} />
        <InfoRow icon={Mail} label="Correo" value={customer.email} />
        <InfoRow icon={MapPin} label="Dirección" value={customer.address} />
        <InfoRow icon={MapPin} label="Ciudad" value={customer.city} />
      </div>

      {customer.notes && (
        <div className="mt-4 rounded-xl border border-border bg-muted/40 p-4 text-sm text-foreground">
          <p className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Notas
          </p>
          {customer.notes}
        </div>
      )}

      <div className="mt-6 grid grid-cols-3 gap-3">
        <StatCard label="Total de compras" value={formatCurrencyCents(0)} />
        <StatCard label="Pedidos" value="0" />
        <StatCard label="Última actividad" value="—" />
      </div>

      <Tabs defaultValue="crm" className="mt-6">
        <TabsList>
          <TabsTrigger value="crm">CRM</TabsTrigger>
          <TabsTrigger value="ventas">Ventas</TabsTrigger>
          <TabsTrigger value="pedidos">Pedidos</TabsTrigger>
          <TabsTrigger value="pagos">Pagos</TabsTrigger>
          <TabsTrigger value="historial">Historial</TabsTrigger>
        </TabsList>
        <TabsContent value="crm" className="space-y-6 pt-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <StatCard
              label="Compras totales"
              value={formatCurrencyCents(crmSummary?.total_purchases_cents ?? 0)}
            />
            <StatCard label="Cantidad de compras" value={String(crmSummary?.purchases_count ?? 0)} />
            <StatCard
              label="Última compra"
              value={
                crmSummary?.last_purchase_at
                  ? new Date(crmSummary.last_purchase_at).toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" })
                  : "—"
              }
            />
            <StatCard label="Leads previos" value={String(crmSummary?.leads_count ?? 0)} />
            <StatCard label="Tareas abiertas" value={String(crmSummary?.open_tasks_count ?? 0)} />
          </div>

          <CrmTaskList tasks={crmTasks} customerId={customer.id} />
          <CrmNoteList notes={crmNotes} owner={{ customerId: customer.id }} />
          <CrmTagPicker currentTags={crmCurrentTags} companyTags={companyTags} owner={{ customerId: customer.id }} />
        </TabsContent>
        <TabsContent value="ventas" className="pt-4">
          <EmptyState
            icon={ShoppingCart}
            title="Sin ventas todavía"
            description="Las ventas de este cliente aparecerán aquí."
          />
        </TabsContent>
        <TabsContent value="pedidos" className="pt-4">
          <EmptyState
            icon={ClipboardList}
            title="Sin pedidos todavía"
            description="Los pedidos de este cliente aparecerán aquí."
          />
        </TabsContent>
        <TabsContent value="pagos" className="pt-4">
          <EmptyState
            icon={Receipt}
            title="Sin pagos todavía"
            description="Los pagos registrados de este cliente aparecerán aquí."
          />
        </TabsContent>
        <TabsContent value="historial" className="pt-4">
          <EmptyState
            icon={History}
            title="Sin actividad todavía"
            description="El historial completo de este cliente aparecerá aquí."
          />
        </TabsContent>
      </Tabs>
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

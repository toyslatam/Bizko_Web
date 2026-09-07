import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Clock, Scissors, Tag } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/lib/auth/session";
import { StatusBadge } from "@/components/catalog/status-badge";
import { ToggleStatusButton } from "@/components/catalog/toggle-status-button";
import { ProfessionalFormSheet } from "@/components/profesionales/professional-form-sheet";
import { ProfessionalServicesSection } from "@/components/profesionales/professional-services-section";
import { CommissionRulesTable } from "@/components/profesionales/commission-rules-table";
import { setProfessionalStatusAction } from "@/app/(app)/profesionales/actions";
import { summarizeWorkDays, formatTimeShort } from "@/lib/professionals";
import type { CommissionRule, Professional, Service } from "@/types/database";

export default async function ProfessionalDetailPage({
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

  const [{ data: professionalData }, { data: servicesData }, { data: assignedData }, { data: rulesData }] =
    await Promise.all([
      supabase.from("professionals").select("*").eq("id", id).maybeSingle(),
      supabase
        .from("services")
        .select("*")
        .eq("company_id", companyId)
        .eq("status", "active")
        .order("name"),
      supabase.from("service_professionals").select("service_id").eq("professional_id", id),
      supabase.from("commission_rules").select("*").eq("professional_id", id),
    ]);

  const professional = professionalData as Professional | null;
  if (!professional) notFound();

  const services = (servicesData ?? []) as Service[];
  const assignedServiceIds = (assignedData ?? []).map((row) => row.service_id as string);
  const assignedServices = services.filter((s) => assignedServiceIds.includes(s.id));
  const rules = (rulesData ?? []) as CommissionRule[];

  return (
    <div className="max-w-3xl">
      <Link
        href="/profesionales"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Profesionales
      </Link>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-muted">
            {professional.photo_url ? (
              <Image
                src={professional.photo_url}
                alt=""
                width={56}
                height={56}
                className="size-full object-cover"
              />
            ) : (
              <Scissors className="size-6 text-muted-foreground" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-heading text-xl font-semibold text-foreground">{professional.name}</h1>
              <StatusBadge status={professional.status} />
            </div>
            {professional.specialty && (
              <p className="text-sm text-muted-foreground">{professional.specialty}</p>
            )}
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <ProfessionalFormSheet companyId={companyId} professional={professional} />
          <ToggleStatusButton
            status={professional.status}
            entityLabel="Profesional"
            onToggle={setProfessionalStatusAction.bind(null, professional.id)}
          />
        </div>
      </div>

      <div className="mt-6 grid gap-3 rounded-xl border border-border bg-card p-4 sm:grid-cols-2">
        <InfoRow icon={Tag} label="Especialidad" value={professional.specialty} />
        <InfoRow
          icon={Clock}
          label="Horario"
          value={`${summarizeWorkDays(professional.work_days)} · ${formatTimeShort(
            professional.work_start_time,
          )}-${formatTimeShort(professional.work_end_time)}`}
        />
      </div>

      <div className="mt-6">
        <h2 className="mb-3 font-heading text-base font-semibold text-foreground">
          Servicios que realiza
        </h2>
        <ProfessionalServicesSection
          professionalId={professional.id}
          services={services}
          assignedServiceIds={assignedServiceIds}
        />
      </div>

      <div className="mt-6">
        <h2 className="mb-3 font-heading text-base font-semibold text-foreground">Comisiones</h2>
        <CommissionRulesTable
          professionalId={professional.id}
          assignedServices={assignedServices}
          rules={rules}
        />
      </div>
    </div>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Tag;
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

import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Wrench } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/lib/auth/session";
import { StatusBadge } from "@/components/catalog/status-badge";
import { ToggleStatusButton } from "@/components/catalog/toggle-status-button";
import { ServiceFormSheet } from "@/components/servicios/service-form-sheet";
import { setServiceStatusAction } from "@/app/(app)/servicios/actions";
import { formatCurrencyCents } from "@/lib/format";
import type { Service, ServiceCategory } from "@/types/database";

export default async function ServiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSessionContext();
  if (!session) redirect("/login");
  if (!session.activeCompany) redirect("/onboarding");

  const { id } = await params;
  const supabase = await createClient();
  const [{ data: serviceData }, { data: categoriesData }] = await Promise.all([
    supabase.from("services").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("service_categories")
      .select("*")
      .eq("company_id", session.activeCompany.id)
      .eq("status", "active")
      .order("name"),
  ]);

  const service = serviceData as Service | null;
  if (!service) notFound();
  const categories = (categoriesData as ServiceCategory[]) ?? [];
  const category = categories.find((c) => c.id === service.category_id);

  return (
    <div className="max-w-2xl">
      <Link
        href="/servicios"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Servicios
      </Link>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-muted">
            {service.image_url ? (
              <Image src={service.image_url} alt="" width={56} height={56} className="size-full object-cover" />
            ) : (
              <Wrench className="size-6 text-muted-foreground" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-heading text-xl font-semibold text-foreground">{service.name}</h1>
              <StatusBadge status={service.status} />
            </div>
            {category && <p className="text-sm text-muted-foreground">{category.name}</p>}
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <ServiceFormSheet companyId={session.activeCompany.id} categories={categories} service={service} />
          <ToggleStatusButton
            status={service.status}
            entityLabel="Servicio"
            onToggle={setServiceStatusAction.bind(null, service.id)}
          />
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3">
        <Metric label="Precio" value={formatCurrencyCents(service.price_cents)} />
        <Metric label="Duración" value={service.duration_minutes ? `${service.duration_minutes} min` : "No definida"} />
      </div>

      {service.description && (
        <div className="mt-4 rounded-xl border border-border bg-muted/40 p-4 text-sm text-foreground">
          <p className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Descripción
          </p>
          {service.description}
        </div>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-heading text-lg font-semibold text-foreground">{value}</p>
    </div>
  );
}

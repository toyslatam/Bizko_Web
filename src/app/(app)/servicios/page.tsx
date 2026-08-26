import { redirect } from "next/navigation";
import { Wrench } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/lib/auth/session";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { ListToolbar } from "@/components/catalog/list-toolbar";
import { ServiceFormSheet } from "@/components/servicios/service-form-sheet";
import { ServiceList } from "@/components/servicios/service-list";
import type { EntityStatus, Service, ServiceCategory } from "@/types/database";

interface PageProps {
  searchParams: Promise<{ q?: string; status?: string; category?: string }>;
}

export default async function ServiciosPage({ searchParams }: PageProps) {
  const session = await getSessionContext();
  if (!session) redirect("/login");
  if (!session.activeCompany) redirect("/onboarding");

  const { q, status, category } = await searchParams;
  const supabase = await createClient();
  const companyId = session.activeCompany.id;

  const { data: categories } = await supabase
    .from("service_categories")
    .select("*")
    .eq("company_id", companyId)
    .eq("status", "active")
    .order("name");

  let query = supabase
    .from("services")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  if (status === "active" || status === "inactive") {
    query = query.eq("status", status satisfies EntityStatus);
  }
  if (category) query = query.eq("category_id", category);
  if (q) query = query.or(`name.ilike.%${q}%,description.ilike.%${q}%`);

  const { data } = await query;
  const services = (data ?? []) as Service[];
  const hasFilters = Boolean(q) || Boolean(status) || Boolean(category);

  return (
    <div>
      <PageHeader
        title="Servicios"
        description="Administra los servicios que ofrece tu negocio."
        actions={
          <ServiceFormSheet companyId={companyId} categories={(categories as ServiceCategory[]) ?? []} />
        }
      />

      {services.length > 0 || hasFilters ? (
        <div className="space-y-4">
          <ListToolbar
            searchPlaceholder="Buscar servicio..."
            categories={(categories as ServiceCategory[])?.map((c) => ({ id: c.id, name: c.name }))}
          />
          {services.length > 0 ? (
            <ServiceList services={services} />
          ) : (
            <EmptyState
              icon={Wrench}
              title="Sin resultados"
              description="No encontramos servicios con esos filtros."
            />
          )}
        </div>
      ) : (
        <EmptyState
          icon={Wrench}
          title="Todavía no tienes servicios"
          description="Agrega un servicio para que tus clientes lo agenden o compren."
          action={
            <ServiceFormSheet companyId={companyId} categories={(categories as ServiceCategory[]) ?? []} />
          }
        />
      )}
    </div>
  );
}

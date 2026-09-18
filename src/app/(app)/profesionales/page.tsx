import { redirect } from "next/navigation";
import { Scissors } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/lib/auth/session";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { ListToolbar } from "@/components/catalog/list-toolbar";
import { ProfessionalFormSheet } from "@/components/profesionales/professional-form-sheet";
import { ProfessionalList } from "@/components/profesionales/professional-list";
import { capitalize, staffTermsFor } from "@/lib/staff-terms";
import type { EntityStatus, Professional } from "@/types/database";

interface PageProps {
  searchParams: Promise<{ q?: string; status?: string }>;
}

export default async function ProfesionalesPage({ searchParams }: PageProps) {
  const session = await getSessionContext();
  if (!session) redirect("/login");
  if (!session.activeCompany) redirect("/onboarding");

  const { q, status } = await searchParams;
  const supabase = await createClient();
  const companyId = session.activeCompany.id;

  let query = supabase
    .from("professionals")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  if (status === "active" || status === "inactive") {
    query = query.eq("status", status satisfies EntityStatus);
  }
  if (q) query = query.or(`name.ilike.%${q}%,specialty.ilike.%${q}%`);

  const { data } = await query;
  const professionals = (data ?? []) as Professional[];
  const hasFilters = Boolean(q) || Boolean(status);
  // En "Varios" son "empleados": la cita depende del servicio, no de con quién.
  const terms = staffTermsFor(session.activeCompany.business_type);

  return (
    <div>
      <PageHeader
        title={capitalize(terms.plural)}
        description="Administra el equipo que atiende a tus clientes."
        actions={<ProfessionalFormSheet companyId={companyId} terms={terms} />}
      />

      {professionals.length > 0 || hasFilters ? (
        <div className="space-y-4">
          <ListToolbar searchPlaceholder={`Buscar ${terms.singular}...`} />
          {professionals.length > 0 ? (
            <ProfessionalList professionals={professionals} />
          ) : (
            <EmptyState
              icon={Scissors}
              title="Sin resultados"
              description={`No encontramos ${terms.plural} con esos filtros.`}
            />
          )}
        </div>
      ) : (
        <EmptyState
          icon={Scissors}
          title={`Todavía no tienes ${terms.plural}`}
          description={`Agrega un ${terms.singular} para asignarle servicios y comisiones.`}
          action={<ProfessionalFormSheet companyId={companyId} terms={terms} />}
        />
      )}
    </div>
  );
}

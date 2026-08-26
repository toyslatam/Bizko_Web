import { redirect } from "next/navigation";
import { PawPrint } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/lib/auth/session";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { ListToolbar } from "@/components/catalog/list-toolbar";
import { PetFormSheet } from "@/components/mascotas/pet-form-sheet";
import { PetList, type PetWithCustomer } from "@/components/mascotas/pet-list";
import type { Customer } from "@/types/database";

interface PageProps {
  searchParams: Promise<{ q?: string }>;
}

export default async function MascotasPage({ searchParams }: PageProps) {
  const session = await getSessionContext();
  if (!session) redirect("/login");
  if (!session.activeCompany) redirect("/onboarding");

  const { q } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("pets")
    .select("*, customers(first_name,last_name)")
    .eq("company_id", session.activeCompany.id)
    .order("created_at", { ascending: false });

  if (q) {
    query = query.or(`name.ilike.%${q}%,species.ilike.%${q}%,breed.ilike.%${q}%`);
  }

  const [{ data: petData }, { data: customerData }] = await Promise.all([
    query,
    supabase
      .from("customers")
      .select("*")
      .eq("company_id", session.activeCompany.id)
      .eq("status", "active")
      .order("first_name", { ascending: true }),
  ]);

  const pets = (petData ?? []) as PetWithCustomer[];
  const customers = (customerData ?? []) as Customer[];
  const hasAnyPet = pets.length > 0 || Boolean(q);

  return (
    <div>
      <PageHeader
        title="Mascotas"
        description="Mascotas registradas de tus clientes."
        actions={<PetFormSheet customers={customers} />}
      />

      {hasAnyPet ? (
        <div className="space-y-4">
          <ListToolbar searchPlaceholder="Buscar mascota..." showStatusFilter={false} />
          {pets.length > 0 ? (
            <PetList pets={pets} />
          ) : (
            <EmptyState
              icon={PawPrint}
              title="Sin resultados"
              description="No encontramos mascotas con esos filtros."
            />
          )}
        </div>
      ) : (
        <EmptyState
          icon={PawPrint}
          title="Todavía no tienes mascotas"
          description="Cuando agregues una mascota, aparecerá aquí."
          action={<PetFormSheet customers={customers} />}
        />
      )}
    </div>
  );
}

import { redirect } from "next/navigation";
import { Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/lib/auth/session";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { ListToolbar } from "@/components/catalog/list-toolbar";
import { CustomerFormSheet } from "@/components/clientes/customer-form-sheet";
import { CustomerList } from "@/components/clientes/customer-list";
import type { Customer, EntityStatus } from "@/types/database";

interface PageProps {
  searchParams: Promise<{ q?: string; status?: string }>;
}

export default async function ClientesPage({ searchParams }: PageProps) {
  const session = await getSessionContext();
  if (!session) redirect("/login");
  if (!session.activeCompany) redirect("/onboarding");

  const { q, status } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("customers")
    .select("*")
    .eq("company_id", session.activeCompany.id)
    .order("created_at", { ascending: false });

  if (status === "active" || status === "inactive") {
    query = query.eq("status", status satisfies EntityStatus);
  }
  if (q) {
    query = query.or(
      `first_name.ilike.%${q}%,last_name.ilike.%${q}%,phone.ilike.%${q}%,email.ilike.%${q}%`,
    );
  }

  const { data } = await query;
  const customers = (data ?? []) as Customer[];
  const hasAnyCustomer = customers.length > 0 || Boolean(q) || Boolean(status);

  return (
    <div>
      <PageHeader
        title="Clientes"
        description="Consulta y administra tu base de clientes."
        actions={<CustomerFormSheet />}
      />

      {hasAnyCustomer ? (
        <div className="space-y-4">
          <ListToolbar searchPlaceholder="Buscar cliente..." />
          {customers.length > 0 ? (
            <CustomerList customers={customers} />
          ) : (
            <EmptyState
              icon={Users}
              title="Sin resultados"
              description="No encontramos clientes con esos filtros."
            />
          )}
        </div>
      ) : (
        <EmptyState
          icon={Users}
          title="Todavía no tienes clientes"
          description="Cuando agregues un cliente, aparecerá aquí."
          action={<CustomerFormSheet />}
        />
      )}
    </div>
  );
}

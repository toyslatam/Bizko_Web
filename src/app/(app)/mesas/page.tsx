import { redirect } from "next/navigation";
import { UtensilsCrossed } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/lib/auth/session";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { TableFormDialog } from "@/components/mesas/table-form-dialog";
import { TableGrid } from "@/components/mesas/table-grid";
import type { RestaurantTable } from "@/types/database";

export default async function MesasPage() {
  const session = await getSessionContext();
  if (!session) redirect("/login");
  if (!session.activeCompany) redirect("/onboarding");
  if (session.activeCompany.business_type !== "food") redirect("/dashboard");

  const supabase = await createClient();
  const { data } = await supabase
    .from("restaurant_tables")
    .select("*")
    .eq("company_id", session.activeCompany.id)
    .order("name");

  const tables = (data as RestaurantTable[]) ?? [];

  return (
    <div>
      <PageHeader
        title="Mesas"
        description="Gestiona las mesas de tu negocio."
        actions={<TableFormDialog />}
      />

      {tables.length === 0 ? (
        <EmptyState
          icon={UtensilsCrossed}
          title="Todavía no tienes mesas"
          description="Cuando agregues una mesa, aparecerá aquí."
          action={<TableFormDialog />}
        />
      ) : (
        <TableGrid tables={tables} />
      )}
    </div>
  );
}

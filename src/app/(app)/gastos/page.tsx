import { redirect } from "next/navigation";
import { Receipt } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/lib/auth/session";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ListToolbar } from "@/components/catalog/list-toolbar";
import { ExpenseFormDialog } from "@/components/gastos/expense-form-dialog";
import { ExpenseList, type ExpenseRow } from "@/components/gastos/expense-list";
import { CategoryList } from "@/components/categorias/category-list";
import { CategoryFormDialog } from "@/components/categorias/category-form-dialog";
import { resolveDateRange } from "@/lib/dates";
import { can } from "@/lib/permissions";
import type { ExpenseCategory, ExpenseStatus } from "@/types/database";

interface PageProps {
  searchParams: Promise<{ q?: string; status?: string; category?: string; range?: string }>;
}

export default async function GastosPage({ searchParams }: PageProps) {
  const session = await getSessionContext();
  if (!session) redirect("/login");
  if (!session.activeCompany) redirect("/onboarding");

  const { q, status, category, range } = await searchParams;
  const supabase = await createClient();
  const companyId = session.activeCompany.id;

  const { data: categoriesData } = await supabase
    .from("expense_categories")
    .select("*")
    .eq("company_id", companyId)
    .order("name");
  const categories = (categoriesData as ExpenseCategory[]) ?? [];
  const activeCategories = categories.filter((c) => c.status === "active");

  let query = supabase
    .from("expenses")
    .select("*, category:expense_categories(name)")
    .eq("company_id", companyId)
    .order("spent_at", { ascending: false });

  if (status === "registered" || status === "voided") {
    query = query.eq("status", status satisfies ExpenseStatus);
  }
  if (category) query = query.eq("category_id", category);
  const dateRange = resolveDateRange(range);
  if (dateRange) query = query.gte("spent_at", dateRange.from.slice(0, 10)).lt("spent_at", dateRange.to.slice(0, 10));
  if (q) query = query.ilike("description", `%${q}%`);

  const { data } = await query;
  const expenses = (data ?? []) as unknown as ExpenseRow[];
  const hasFilters = Boolean(q) || Boolean(status) || Boolean(category) || Boolean(range);
  const canVoid = can(session.activeMembership?.role ?? "employee", "gastos.anular");

  return (
    <div>
      <PageHeader
        title="Gastos"
        description="Registra los gastos de tu negocio."
        actions={<ExpenseFormDialog categories={activeCategories} />}
      />

      <Tabs defaultValue="gastos">
        <TabsList>
          <TabsTrigger value="gastos">Gastos</TabsTrigger>
          <TabsTrigger value="categorias">Categorías</TabsTrigger>
        </TabsList>

        <TabsContent value="gastos" className="space-y-4 pt-4">
          {expenses.length > 0 || hasFilters ? (
            <>
              <ListToolbar
                searchPlaceholder="Buscar gasto..."
                categories={activeCategories.map((c) => ({ id: c.id, name: c.name }))}
                statusOptions={[
                  { value: "registered", label: "Registrado" },
                  { value: "voided", label: "Anulado" },
                ]}
              />
              {expenses.length > 0 ? (
                <ExpenseList expenses={expenses} canVoid={canVoid} />
              ) : (
                <EmptyState icon={Receipt} title="Sin resultados" description="No encontramos gastos con esos filtros." />
              )}
            </>
          ) : (
            <EmptyState
              icon={Receipt}
              title="Aún no tienes gastos registrados"
              description="Registra un gasto para llevar el control de tu operación."
              action={<ExpenseFormDialog categories={activeCategories} />}
            />
          )}
        </TabsContent>

        <TabsContent value="categorias" className="space-y-4 pt-4">
          {categories.length > 0 && (
            <div className="flex justify-end">
              <CategoryFormDialog kind="expense" />
            </div>
          )}
          <CategoryList kind="expense" categories={categories} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

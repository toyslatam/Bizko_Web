import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/lib/auth/session";
import { PageHeader } from "@/components/ui/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CategoryList } from "@/components/categorias/category-list";
import { CategoryFormDialog } from "@/components/categorias/category-form-dialog";
import type { ProductCategory, ServiceCategory } from "@/types/database";

export default async function CategoriasPage() {
  const session = await getSessionContext();
  if (!session) redirect("/login");
  if (!session.activeCompany) redirect("/onboarding");

  const supabase = await createClient();
  const [{ data: productCategories }, { data: serviceCategories }] = await Promise.all([
    supabase
      .from("product_categories")
      .select("*")
      .eq("company_id", session.activeCompany.id)
      .order("name"),
    supabase
      .from("service_categories")
      .select("*")
      .eq("company_id", session.activeCompany.id)
      .order("name"),
  ]);

  return (
    <div>
      <PageHeader
        title="Categorías"
        description="Organiza tus productos y servicios en categorías."
      />

      <Tabs defaultValue="productos">
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="productos">De productos</TabsTrigger>
            <TabsTrigger value="servicios">De servicios</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="productos" className="space-y-4 pt-4">
          {(productCategories as ProductCategory[] | null)?.length ? (
            <div className="flex justify-end">
              <CategoryFormDialog kind="product" />
            </div>
          ) : null}
          <CategoryList kind="product" categories={(productCategories as ProductCategory[]) ?? []} />
        </TabsContent>

        <TabsContent value="servicios" className="space-y-4 pt-4">
          {(serviceCategories as ServiceCategory[] | null)?.length ? (
            <div className="flex justify-end">
              <CategoryFormDialog kind="service" />
            </div>
          ) : null}
          <CategoryList kind="service" categories={(serviceCategories as ServiceCategory[]) ?? []} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

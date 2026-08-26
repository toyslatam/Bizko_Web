import { redirect } from "next/navigation";
import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/lib/auth/session";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { SalesToolbar } from "@/components/ventas/sales-toolbar";
import { SaleList, type SaleRow } from "@/components/ventas/sale-list";
import { resolveDateRange } from "@/lib/dates";
import type { PaymentMethod, SaleStatus } from "@/types/database";

interface PageProps {
  searchParams: Promise<{ q?: string; status?: string; payment?: string; range?: string }>;
}

export default async function VentasPage({ searchParams }: PageProps) {
  const session = await getSessionContext();
  if (!session) redirect("/login");
  if (!session.activeCompany) redirect("/onboarding");

  const { q, status, payment, range } = await searchParams;
  const supabase = await createClient();
  const companyId = session.activeCompany.id;

  let query = supabase
    .from("sales")
    .select("*, customer:customers(first_name,last_name), user:profiles(first_name,last_name,email)")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  if (status === "completed" || status === "voided") {
    query = query.eq("status", status satisfies SaleStatus);
  }
  if (payment && payment !== "all") {
    query = query.eq("payment_method", payment as PaymentMethod);
  }
  const dateRange = resolveDateRange(range);
  if (dateRange) query = query.gte("created_at", dateRange.from).lt("created_at", dateRange.to);
  if (q) query = query.ilike("sale_number", `%${q}%`);

  const { data } = await query;
  let sales = (data ?? []) as unknown as SaleRow[];

  // El filtro por nombre de cliente no se puede hacer en la consulta (customers
  // está embebido), así que se aplica aquí si el número de venta no matcheó.
  if (q && sales.length === 0) {
    const { data: byCustomer } = await supabase
      .from("sales")
      .select("*, customer:customers(first_name,last_name), user:profiles(first_name,last_name,email)")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });
    const needle = q.toLowerCase();
    sales = ((byCustomer ?? []) as unknown as SaleRow[]).filter((s) => {
      const name = s.customer ? `${s.customer.first_name} ${s.customer.last_name ?? ""}` : "cliente general";
      return name.toLowerCase().includes(needle) || s.sale_number.toLowerCase().includes(needle);
    });
  }

  const hasFilters = Boolean(q) || Boolean(status) || Boolean(payment) || Boolean(range);

  return (
    <div>
      <PageHeader
        title="Ventas"
        description="Consulta y registra las ventas de tu negocio."
        actions={
          <Button asChild>
            <Link href="/ventas/nuevo">Nueva venta</Link>
          </Button>
        }
      />

      {sales.length > 0 || hasFilters ? (
        <div className="space-y-4">
          <SalesToolbar />
          {sales.length > 0 ? (
            <SaleList sales={sales} />
          ) : (
            <EmptyState
              icon={ShoppingCart}
              title="Sin resultados"
              description="No encontramos ventas con esos filtros."
            />
          )}
        </div>
      ) : (
        <EmptyState
          icon={ShoppingCart}
          title="Comienza registrando tu primera venta"
          description="Cuando registres una venta, aparecerá aquí."
          action={
            <Button asChild>
              <Link href="/ventas/nuevo">Crear venta</Link>
            </Button>
          }
        />
      )}
    </div>
  );
}

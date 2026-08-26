import Link from "next/link";
import { Building2 } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { EmpresasFilterBar } from "@/components/admin/empresas-filter-bar";
import { CompanyList, type AdminCompanyRow } from "@/components/admin/company-list";

const PAGE_SIZE = 25;

interface PageProps {
  searchParams: Promise<{
    q?: string;
    plan?: string;
    business_type?: string;
    status?: string;
    page?: string;
  }>;
}

export default async function AdminEmpresasPage({ searchParams }: PageProps) {
  const { q, plan, business_type, status, page } = await searchParams;
  const currentPage = Math.max(1, Number(page) || 1);
  const supabase = await createClient();

  const { data } = await supabase.rpc("admin_list_companies", {
    p_search: q || null,
    p_plan_code: plan || null,
    p_business_type: business_type || null,
    p_status: status || null,
    p_limit: PAGE_SIZE,
    p_offset: (currentPage - 1) * PAGE_SIZE,
  });

  const rows = (data ?? []) as (AdminCompanyRow & { total_count: number })[];
  const totalCount = rows[0]?.total_count ?? 0;
  const hasFilters = Boolean(q || plan || business_type || status);
  const hasNextPage = currentPage * PAGE_SIZE < totalCount;

  function pageHref(targetPage: number) {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (plan) params.set("plan", plan);
    if (business_type) params.set("business_type", business_type);
    if (status) params.set("status", status);
    if (targetPage > 1) params.set("page", String(targetPage));
    const qs = params.toString();
    return qs ? `/admin/empresas?${qs}` : "/admin/empresas";
  }

  return (
    <div>
      <PageHeader title="Empresas" description="Todas las empresas registradas en bizko." />

      <div className="space-y-4">
        <EmpresasFilterBar />

        {rows.length > 0 ? (
          <>
            <CompanyList companies={rows} />
            <div className="flex items-center justify-between pt-2">
              <p className="text-sm text-muted-foreground">
                {totalCount} {totalCount === 1 ? "empresa" : "empresas"}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={currentPage <= 1} asChild={currentPage > 1}>
                  {currentPage > 1 ? <Link href={pageHref(currentPage - 1)}>Anterior</Link> : <span>Anterior</span>}
                </Button>
                <Button variant="outline" size="sm" disabled={!hasNextPage} asChild={hasNextPage}>
                  {hasNextPage ? <Link href={pageHref(currentPage + 1)}>Siguiente</Link> : <span>Siguiente</span>}
                </Button>
              </div>
            </div>
          </>
        ) : (
          <EmptyState
            icon={Building2}
            title={hasFilters ? "Sin resultados" : "Todavía no hay empresas registradas"}
            description={
              hasFilters
                ? "No encontramos empresas con esos filtros."
                : "Cuando se registren negocios en bizko, aparecerán aquí."
            }
          />
        )}
      </div>
    </div>
  );
}

import Link from "next/link";
import { CreditCard } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { MobileList, MobileListItem } from "@/components/ui/mobile-list";
import { SubscriptionFilterBar } from "@/components/admin/subscription-filter-bar";
import { AdminPagination } from "@/components/admin/admin-pagination";
import { createClient } from "@/lib/supabase/server";
import { formatCurrencyCents } from "@/lib/format";
import { SUBSCRIPTION_STATUS_LABELS } from "@/lib/plans";
import type { SubscriptionStatus } from "@/types/database";

const PAGE_SIZE = 25;

interface AdminSubscriptionRow {
  company_id: string;
  company_name: string;
  plan_id: string;
  plan_name: string;
  plan_code: string;
  status: SubscriptionStatus;
  price_monthly_cents: number;
  start_date: string;
  trial_ends_at: string | null;
  end_date: string | null;
  total_count: number;
}

interface PageProps {
  searchParams: Promise<{ status?: string; q?: string; page?: string }>;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default async function AdminSubscriptionsPage({ searchParams }: PageProps) {
  const { status, q, page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const supabase = await createClient();
  const { data } = await supabase.rpc("admin_list_subscriptions", {
    p_status: status || null,
    p_search: q || null,
    p_limit: PAGE_SIZE,
    p_offset: offset,
  });

  const subscriptions = (data ?? []) as AdminSubscriptionRow[];
  const totalCount = subscriptions[0]?.total_count ?? 0;

  return (
    <div>
      <PageHeader title="Suscripciones" description="Todas las suscripciones de bizko." />

      <div className="space-y-4">
        <SubscriptionFilterBar placeholder="Buscar empresa..." />

        {subscriptions.length === 0 ? (
          <EmptyState
            icon={CreditCard}
            title="Sin resultados"
            description="No encontramos suscripciones con esos filtros."
          />
        ) : (
          <>
            <div className="hidden overflow-hidden rounded-xl border border-border md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Precio</TableHead>
                    <TableHead>Inicio</TableHead>
                    <TableHead>Prueba hasta</TableHead>
                    <TableHead>Renovación/Fin</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {subscriptions.map((s) => (
                    <TableRow key={s.company_id}>
                      <TableCell className="font-medium text-foreground">
                        <Link href={`/admin/empresas/${s.company_id}`} className="hover:underline">
                          {s.company_name}
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{s.plan_name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{SUBSCRIPTION_STATUS_LABELS[s.status]}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatCurrencyCents(s.price_monthly_cents)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{formatDate(s.start_date)}</TableCell>
                      <TableCell className="text-muted-foreground">{formatDate(s.trial_ends_at)}</TableCell>
                      <TableCell className="text-muted-foreground">{formatDate(s.end_date)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <MobileList>
              {subscriptions.map((s) => (
                <MobileListItem
                  key={s.company_id}
                  href={`/admin/empresas/${s.company_id}`}
                  title={s.company_name}
                  subtitle={`${s.plan_name} · ${formatCurrencyCents(s.price_monthly_cents)}`}
                  trailing={<Badge variant="outline">{SUBSCRIPTION_STATUS_LABELS[s.status]}</Badge>}
                />
              ))}
            </MobileList>

            <AdminPagination
              page={page}
              pageSize={PAGE_SIZE}
              totalCount={totalCount}
              buildHref={(p) => {
                const params = new URLSearchParams();
                if (q) params.set("q", q);
                if (status) params.set("status", status);
                params.set("page", String(p));
                return `/admin/suscripciones?${params.toString()}`;
              }}
            />
          </>
        )}
      </div>
    </div>
  );
}

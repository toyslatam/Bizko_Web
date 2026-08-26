import { Activity } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { MobileList, MobileListItem } from "@/components/ui/mobile-list";
import { AdminPagination } from "@/components/admin/admin-pagination";
import { createClient } from "@/lib/supabase/server";
import { adminActionLabel } from "@/lib/admin";

const PAGE_SIZE = 30;

interface AuditLogRow {
  id: string;
  action: string;
  target_type: string;
  target_id: string | null;
  company_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  company: { name: string } | null;
}

interface PageProps {
  searchParams: Promise<{ page?: string }>;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function metadataReason(metadata: Record<string, unknown> | null): string | undefined {
  const reason = metadata?.reason;
  return typeof reason === "string" && reason.length > 0 ? reason : undefined;
}

export default async function AdminActivityPage({ searchParams }: PageProps) {
  const page = Math.max(1, Number((await searchParams).page) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const supabase = await createClient();
  const { data, count } = await supabase
    .from("admin_audit_logs")
    .select("*, company:companies(name)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  const logs = (data ?? []) as unknown as AuditLogRow[];
  const totalCount = count ?? 0;

  return (
    <div>
      <PageHeader title="Actividad" description="Eventos importantes de la plataforma." />

      {logs.length === 0 ? (
        <EmptyState
          icon={Activity}
          title="Sin actividad registrada"
          description="Todavía no hay actividad registrada."
        />
      ) : (
        <div className="space-y-4">
          <div className="hidden overflow-hidden rounded-xl border border-border md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Evento</TableHead>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Fecha</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => {
                  const reason = metadataReason(log.metadata);
                  return (
                    <TableRow key={log.id}>
                      <TableCell className="font-medium text-foreground">
                        {adminActionLabel(log.action)}
                        {reason && (
                          <p className="mt-0.5 text-xs font-normal text-muted-foreground">
                            {reason}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {log.company?.name ?? "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDateTime(log.created_at)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <MobileList>
            {logs.map((log) => (
              <MobileListItem
                key={log.id}
                title={adminActionLabel(log.action)}
                subtitle={`${log.company?.name ?? "—"} · ${formatDateTime(log.created_at)}`}
              />
            ))}
          </MobileList>

          <AdminPagination
            page={page}
            pageSize={PAGE_SIZE}
            totalCount={totalCount}
            buildHref={(p) => `/admin/actividad?page=${p}`}
          />
        </div>
      )}
    </div>
  );
}

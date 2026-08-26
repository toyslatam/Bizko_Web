import { Users } from "lucide-react";
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
import { UserSearchBar } from "@/components/admin/user-search-bar";
import { AdminPagination } from "@/components/admin/admin-pagination";
import { createClient } from "@/lib/supabase/server";

const PAGE_SIZE = 25;

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  owner: "Dueño",
  manager: "Gerente",
  employee: "Empleado",
};

const MEMBER_STATUS_LABELS: Record<string, string> = {
  active: "Activo",
  invited: "Invitación pendiente",
  inactive: "Inactivo",
};

interface AdminUserRow {
  user_id: string;
  full_name: string | null;
  email: string;
  company_name: string | null;
  role: string | null;
  member_status: string | null;
  created_at: string;
  total_count: number;
}

interface PageProps {
  searchParams: Promise<{ q?: string; page?: string }>;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default async function AdminUsersPage({ searchParams }: PageProps) {
  const { q, page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const supabase = await createClient();
  const { data } = await supabase.rpc("admin_list_users", {
    p_search: q || null,
    p_limit: PAGE_SIZE,
    p_offset: offset,
  });

  const users = (data ?? []) as AdminUserRow[];
  const totalCount = users[0]?.total_count ?? 0;

  return (
    <div>
      <PageHeader title="Usuarios" description="Todos los usuarios registrados en bizko." />

      <div className="space-y-4">
        <UserSearchBar placeholder="Buscar por nombre o correo..." />

        {users.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Sin resultados"
            description="No encontramos usuarios con esos filtros."
          />
        ) : (
          <>
            <div className="hidden overflow-hidden rounded-xl border border-border md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Correo</TableHead>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Rol</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Registro</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u) => (
                    <TableRow key={u.user_id}>
                      <TableCell className="font-medium text-foreground">
                        {u.full_name || "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{u.email}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {u.company_name || "Sin empresa"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {u.role ? ROLE_LABELS[u.role] ?? u.role : "—"}
                      </TableCell>
                      <TableCell>
                        {u.member_status ? (
                          <Badge variant="outline">
                            {MEMBER_STATUS_LABELS[u.member_status] ?? u.member_status}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(u.created_at)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <MobileList>
              {users.map((u) => (
                <MobileListItem
                  key={u.user_id}
                  title={u.full_name || u.email}
                  subtitle={u.company_name || "Sin empresa"}
                  trailing={
                    u.member_status ? (
                      <Badge variant="outline">
                        {MEMBER_STATUS_LABELS[u.member_status] ?? u.member_status}
                      </Badge>
                    ) : undefined
                  }
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
                params.set("page", String(p));
                return `/admin/usuarios?${params.toString()}`;
              }}
            />
          </>
        )}
      </div>
    </div>
  );
}

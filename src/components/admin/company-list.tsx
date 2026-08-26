import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { MobileList, MobileListItem } from "@/components/ui/mobile-list";
import { Badge } from "@/components/ui/badge";
import { SUBSCRIPTION_STATUS_LABELS } from "@/lib/plans";
import { BUSINESS_MODULES } from "@/modules/registry";
import type { BusinessType, SubscriptionStatus } from "@/types/database";

export interface AdminCompanyRow {
  id: string;
  name: string;
  business_type: BusinessType;
  owner_name: string | null;
  owner_email: string | null;
  plan_name: string | null;
  status: SubscriptionStatus | null;
  created_at: string;
  last_activity: string | null;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" });
}

function statusBadgeVariant(status: SubscriptionStatus | null): "default" | "secondary" | "outline" | "destructive" {
  if (!status) return "outline";
  if (status === "active") return "default";
  if (status === "trial") return "secondary";
  if (status === "past_due" || status === "suspended") return "destructive";
  return "outline";
}

function CompanyStatusBadge({ status }: { status: SubscriptionStatus | null }) {
  return (
    <Badge variant={statusBadgeVariant(status)}>
      {status ? SUBSCRIPTION_STATUS_LABELS[status] : "Sin suscripción"}
    </Badge>
  );
}

function businessTypeLabel(type: BusinessType): string {
  const businessModule = BUSINESS_MODULES.find((m) => m.type === type);
  return businessModule ? `${businessModule.emoji} ${businessModule.name}` : type;
}

export function CompanyList({ companies }: { companies: AdminCompanyRow[] }) {
  return (
    <>
      <div className="hidden overflow-hidden rounded-xl border border-border md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Negocio</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Propietario</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Registro</TableHead>
              <TableHead>Última actividad</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {companies.map((c) => (
              <TableRow key={c.id} className="cursor-pointer">
                <TableCell className="font-medium text-foreground">
                  <Link href={`/admin/empresas/${c.id}`} className="block">
                    {c.name}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground">{businessTypeLabel(c.business_type)}</TableCell>
                <TableCell className="text-muted-foreground">
                  <div>{c.owner_name || "—"}</div>
                  {c.owner_email && <div className="text-xs">{c.owner_email}</div>}
                </TableCell>
                <TableCell className="text-muted-foreground">{c.plan_name || "—"}</TableCell>
                <TableCell>
                  <CompanyStatusBadge status={c.status} />
                </TableCell>
                <TableCell className="text-muted-foreground">{formatDate(c.created_at)}</TableCell>
                <TableCell className="text-muted-foreground">{formatDate(c.last_activity)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <MobileList>
        {companies.map((c) => (
          <MobileListItem
            key={c.id}
            href={`/admin/empresas/${c.id}`}
            title={c.name}
            subtitle={c.owner_email || businessTypeLabel(c.business_type)}
            trailing={<CompanyStatusBadge status={c.status} />}
          />
        ))}
      </MobileList>
    </>
  );
}

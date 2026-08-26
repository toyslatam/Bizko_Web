import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, History } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/lib/auth/session";
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
import { Badge } from "@/components/ui/badge";
import { formatCurrencyCents } from "@/lib/format";
import type { CashRegister, Profile } from "@/types/database";

interface RegisterRow extends CashRegister {
  opener: Pick<Profile, "first_name" | "last_name" | "email"> | null;
}

function userLabel(user: RegisterRow["opener"]) {
  if (!user) return "—";
  const name = [user.first_name, user.last_name].filter(Boolean).join(" ");
  return name || user.email.split("@")[0];
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" });
}

export default async function CajaHistorialPage() {
  const session = await getSessionContext();
  if (!session) redirect("/login");
  if (!session.activeCompany) redirect("/onboarding");

  const supabase = await createClient();
  const { data } = await supabase
    .from("cash_registers")
    .select("*, opener:profiles!cash_registers_opened_by_profiles_fkey(first_name,last_name,email)")
    .eq("company_id", session.activeCompany.id)
    .order("opened_at", { ascending: false });

  const registers = (data ?? []) as unknown as RegisterRow[];

  return (
    <div>
      <Link
        href="/caja"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Caja
      </Link>
      <PageHeader title="Historial de cajas" description="Todas las aperturas y cierres de caja." />

      {registers.length === 0 ? (
        <EmptyState icon={History} title="Sin cajas todavía" description="Cuando abras tu primera caja, aparecerá aquí." />
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-xl border border-border md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Apertura</TableHead>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Saldo inicial</TableHead>
                  <TableHead>Cierre</TableHead>
                  <TableHead>Contado</TableHead>
                  <TableHead>Diferencia</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {registers.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium text-foreground">
                      <Link href={`/caja/historial/${r.id}`}>{formatDateTime(r.opened_at)}</Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{userLabel(r.opener)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatCurrencyCents(r.opening_amount_cents)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {r.closed_at ? formatDateTime(r.closed_at) : "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {r.counted_amount_cents !== null ? formatCurrencyCents(r.counted_amount_cents) : "—"}
                    </TableCell>
                    <TableCell
                      className={
                        r.difference_cents === null
                          ? "text-muted-foreground"
                          : r.difference_cents === 0
                            ? "text-success"
                            : "text-destructive"
                      }
                    >
                      {r.difference_cents !== null ? formatCurrencyCents(r.difference_cents) : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={r.status === "open" ? "default" : "outline"}>
                        {r.status === "open" ? "Abierta" : "Cerrada"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <MobileList>
            {registers.map((r) => (
              <MobileListItem
                key={r.id}
                href={`/caja/historial/${r.id}`}
                title={formatDateTime(r.opened_at)}
                subtitle={`${userLabel(r.opener)} · ${formatCurrencyCents(r.opening_amount_cents)}`}
                trailing={
                  <Badge variant={r.status === "open" ? "default" : "outline"} className="text-[10px]">
                    {r.status === "open" ? "Abierta" : "Cerrada"}
                  </Badge>
                }
              />
            ))}
          </MobileList>
        </>
      )}
    </div>
  );
}

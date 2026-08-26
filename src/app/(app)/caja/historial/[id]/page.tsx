import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/lib/auth/session";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Wallet } from "lucide-react";
import { CashMovementList, type CashMovementRow } from "@/components/caja/cash-movement-list";
import { formatCurrencyCents } from "@/lib/format";
import type { CashRegister, Profile } from "@/types/database";

interface RegisterDetail extends CashRegister {
  opener: Pick<Profile, "first_name" | "last_name" | "email"> | null;
  closer: Pick<Profile, "first_name" | "last_name" | "email"> | null;
}

function userLabel(user: { first_name: string | null; last_name: string | null; email: string } | null) {
  if (!user) return "—";
  const name = [user.first_name, user.last_name].filter(Boolean).join(" ");
  return name || user.email.split("@")[0];
}

export default async function CashRegisterDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSessionContext();
  if (!session) redirect("/login");
  if (!session.activeCompany) redirect("/onboarding");

  const { id } = await params;
  const supabase = await createClient();

  const [{ data: registerData }, { data: movementsData }] = await Promise.all([
    supabase
      .from("cash_registers")
      .select(
        "*, opener:profiles!cash_registers_opened_by_profiles_fkey(first_name,last_name,email), closer:profiles!cash_registers_closed_by_profiles_fkey(first_name,last_name,email)",
      )
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("cash_movements")
      .select("*, user:profiles(first_name,last_name,email)")
      .eq("cash_register_id", id)
      .order("created_at", { ascending: false }),
  ]);

  const register = registerData as unknown as RegisterDetail | null;
  if (!register) notFound();
  const movements = (movementsData ?? []) as unknown as CashMovementRow[];
  const incomeCents = movements.filter((m) => m.movement_type === "income").reduce((s, m) => s + m.amount_cents, 0);
  const expenseCents = movements.filter((m) => m.movement_type === "expense").reduce((s, m) => s + m.amount_cents, 0);

  return (
    <div>
      <Link
        href="/caja/historial"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Historial de cajas
      </Link>

      <div className="flex items-center gap-2">
        <h1 className="font-heading text-xl font-semibold text-foreground">
          Caja del {new Date(register.opened_at).toLocaleDateString("es-CO", { dateStyle: "long" })}
        </h1>
        <Badge variant={register.status === "open" ? "default" : "outline"}>
          {register.status === "open" ? "Abierta" : "Cerrada"}
        </Badge>
      </div>

      <div className="mt-4 grid gap-3 rounded-xl border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Abierta por" value={userLabel(register.opener)} />
        <Field label="Saldo inicial" value={formatCurrencyCents(register.opening_amount_cents)} />
        <Field label="Ingresos" value={formatCurrencyCents(incomeCents)} />
        <Field label="Egresos" value={formatCurrencyCents(Math.abs(expenseCents))} />
      </div>

      {register.status === "closed" && (
        <div className="mt-4 grid gap-3 rounded-xl border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Cerrada por" value={userLabel(register.closer)} />
          <Field label="Esperado" value={formatCurrencyCents(register.expected_amount_cents ?? 0)} />
          <Field label="Contado" value={formatCurrencyCents(register.counted_amount_cents ?? 0)} />
          <Field
            label="Diferencia"
            value={formatCurrencyCents(register.difference_cents ?? 0)}
            tone={
              register.difference_cents === 0
                ? undefined
                : (register.difference_cents ?? 0) > 0
                  ? "success"
                  : "destructive"
            }
          />
        </div>
      )}

      {(register.opening_notes || register.closing_notes) && (
        <div className="mt-4 space-y-2 rounded-xl border border-border bg-muted/40 p-4 text-sm text-foreground">
          {register.opening_notes && (
            <p>
              <span className="font-medium">Notas de apertura: </span>
              {register.opening_notes}
            </p>
          )}
          {register.closing_notes && (
            <p>
              <span className="font-medium">Notas de cierre: </span>
              {register.closing_notes}
            </p>
          )}
        </div>
      )}

      <div className="mt-6">
        <p className="mb-2 text-sm font-medium text-foreground">Movimientos</p>
        {movements.length > 0 ? (
          <CashMovementList movements={movements} />
        ) : (
          <EmptyState icon={Wallet} title="Sin movimientos" description="Esta caja no tuvo movimientos registrados." />
        )}
      </div>
    </div>
  );
}

function Field({ label, value, tone }: { label: string; value: string; tone?: "success" | "destructive" }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={`text-sm font-medium ${tone === "success" ? "text-success" : tone === "destructive" ? "text-destructive" : "text-foreground"}`}
      >
        {value}
      </p>
    </div>
  );
}

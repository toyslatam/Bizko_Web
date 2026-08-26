import { redirect } from "next/navigation";
import Link from "next/link";
import { Wallet, History } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/lib/auth/session";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { OpenRegisterDialog } from "@/components/caja/open-register-dialog";
import { CloseRegisterDialog } from "@/components/caja/close-register-dialog";
import { ManualMovementDialog } from "@/components/caja/manual-movement-dialog";
import { CashSummary } from "@/components/caja/cash-summary";
import { CashMovementList, type CashMovementRow } from "@/components/caja/cash-movement-list";
import { can } from "@/lib/permissions";
import { formatCurrencyCents } from "@/lib/format";
import type { CashRegister, PaymentMethod } from "@/types/database";

export default async function CajaPage() {
  const session = await getSessionContext();
  if (!session) redirect("/login");
  if (!session.activeCompany) redirect("/onboarding");

  const supabase = await createClient();
  const companyId = session.activeCompany.id;

  const { data: registerData } = await supabase
    .from("cash_registers")
    .select("*")
    .eq("company_id", companyId)
    .eq("status", "open")
    .maybeSingle();

  const register = registerData as CashRegister | null;
  const canAdminister = can(session.activeMembership?.role ?? "employee", "caja.administrar");
  const canRegister = can(session.activeMembership?.role ?? "employee", "caja.registrar");

  if (!register) {
    return (
      <div>
        <PageHeader title="Caja" description="El control del dinero de tu negocio." />
        <EmptyState
          icon={Wallet}
          title="Tu caja está cerrada"
          description="Abre la caja para empezar a registrar el dinero que entra y sale hoy."
          action={
            canAdminister ? (
              <OpenRegisterDialog />
            ) : (
              <p className="text-sm text-muted-foreground">
                Pide a un gerente o al dueño que abra la caja.
              </p>
            )
          }
        />
        <div className="mt-4 text-center">
          <Link href="/caja/historial" className="text-sm font-medium text-brand hover:underline">
            Ver historial de cajas
          </Link>
        </div>
      </div>
    );
  }

  const { data: movementsData } = await supabase
    .from("cash_movements")
    .select("*, user:profiles(first_name,last_name,email)")
    .eq("cash_register_id", register.id)
    .order("created_at", { ascending: false });

  const movements = (movementsData ?? []) as unknown as CashMovementRow[];

  const incomeCents = movements.filter((m) => m.movement_type === "income").reduce((s, m) => s + m.amount_cents, 0);
  const expenseCents = movements.filter((m) => m.movement_type === "expense").reduce((s, m) => s + m.amount_cents, 0);
  const balanceCents = register.opening_amount_cents + movements.reduce((s, m) => s + m.amount_cents, 0);
  const expectedCashCents =
    register.opening_amount_cents +
    movements.filter((m) => m.payment_method === "cash").reduce((s, m) => s + m.amount_cents, 0);

  const byPaymentMethod: Partial<Record<PaymentMethod, number>> = {};
  for (const m of movements) {
    byPaymentMethod[m.payment_method] = (byPaymentMethod[m.payment_method] ?? 0) + m.amount_cents;
  }

  return (
    <div>
      <PageHeader
        title="Caja"
        description="El control del dinero de tu negocio."
        actions={
          <Button variant="ghost" size="sm" asChild>
            <Link href="/caja/historial">
              <History /> Historial
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div>
          {movements.length > 0 ? (
            <CashMovementList movements={movements} />
          ) : (
            <EmptyState
              icon={Wallet}
              title="Sin movimientos todavía"
              description="Registra un ingreso, un egreso o una venta para verlos aquí."
            />
          )}
        </div>

        <div className="space-y-4">
          <CashSummary
            data={{
              openingCents: register.opening_amount_cents,
              incomeCents,
              expenseCents,
              balanceCents,
              byPaymentMethod,
            }}
          />
          <div className="flex flex-col gap-2">
            {canRegister && <ManualMovementDialog cashRegisterId={register.id} />}
            {canAdminister && (
              <CloseRegisterDialog cashRegisterId={register.id} expectedCashCents={expectedCashCents} />
            )}
          </div>
          <p className="text-center text-xs text-muted-foreground">
            Caja abierta con {formatCurrencyCents(register.opening_amount_cents)}
          </p>
        </div>
      </div>
    </div>
  );
}

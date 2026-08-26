import { formatCurrencyCents } from "@/lib/format";
import { PAYMENT_METHOD_LABELS } from "@/lib/sales";
import type { PaymentMethod } from "@/types/database";

export interface CashSummaryData {
  openingCents: number;
  incomeCents: number;
  expenseCents: number;
  balanceCents: number;
  byPaymentMethod: Partial<Record<PaymentMethod, number>>;
}

export function CashSummary({ data }: { data: CashSummaryData }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <p className="text-sm text-muted-foreground">Dinero en caja</p>
      <p className="mt-1 font-heading text-3xl font-semibold text-foreground">
        {formatCurrencyCents(data.balanceCents)}
      </p>

      <div className="mt-4 space-y-1.5 border-t border-border pt-4 text-sm">
        <Row label="Saldo inicial" value={data.openingCents} />
        <Row label="Ingresos" value={data.incomeCents} tone="success" prefix="+" />
        <Row label="Egresos" value={Math.abs(data.expenseCents)} tone="destructive" prefix="-" />
        <div className="flex items-center justify-between border-t border-border pt-1.5 font-semibold text-foreground">
          <span>Saldo actual</span>
          <span>{formatCurrencyCents(data.balanceCents)}</span>
        </div>
      </div>

      {Object.keys(data.byPaymentMethod).length > 0 && (
        <div className="mt-4 grid grid-cols-3 gap-2 border-t border-border pt-4">
          {(Object.entries(data.byPaymentMethod) as [PaymentMethod, number][]).map(([method, amount]) => (
            <div key={method} className="rounded-lg bg-muted/60 px-2 py-2 text-center">
              <p className="text-[11px] text-muted-foreground">{PAYMENT_METHOD_LABELS[method]}</p>
              <p className="text-sm font-medium text-foreground">{formatCurrencyCents(amount)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Row({
  label,
  value,
  tone,
  prefix = "",
}: {
  label: string;
  value: number;
  tone?: "success" | "destructive";
  prefix?: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={tone === "success" ? "text-success" : tone === "destructive" ? "text-destructive" : "text-foreground"}>
        {prefix}
        {formatCurrencyCents(value)}
      </span>
    </div>
  );
}

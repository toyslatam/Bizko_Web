import Link from "next/link";
import { PLAN_LIMIT_LABELS, formatLimitValue, usagePct } from "@/lib/plans";
import type { Plan, PlanUsageRow } from "@/types/database";

export function PlanUsageCard({ plan, usage }: { plan: Plan | null; usage: PlanUsageRow[] }) {
  if (!plan || usage.length === 0) return null;

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-heading text-base font-semibold text-foreground">Tu plan</h2>
        <Link href="/configuracion?tab=plan" className="text-sm font-medium text-brand hover:underline">
          Administrar plan
        </Link>
      </div>
      <div className="rounded-xl border border-border bg-card p-4">
        <p className="text-sm font-semibold text-foreground">Plan {plan.name}</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {usage.map((row) => {
            const pct = usagePct(row);
            return (
              <div key={row.limit_key}>
                <div className="flex items-baseline justify-between text-xs">
                  <span className="text-muted-foreground">{PLAN_LIMIT_LABELS[row.limit_key]}</span>
                  <span className="font-medium text-foreground">
                    {row.current_usage} / {formatLimitValue(row.limit_key, row.limit_value)}
                  </span>
                </div>
                {pct !== null && (
                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full rounded-full ${pct >= 100 ? "bg-destructive" : pct >= 80 ? "bg-warning" : "bg-brand"}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

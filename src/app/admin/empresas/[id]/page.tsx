import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Mail, MapPin, Phone, Calendar } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { CompanyActionsPanel } from "@/components/admin/company-actions-panel";
import { PLAN_LIMIT_LABELS, SUBSCRIPTION_STATUS_LABELS, formatLimitValue, usagePct } from "@/lib/plans";
import { ORDER_STATUS_LABELS } from "@/lib/orders";
import { formatCurrencyCents } from "@/lib/format";
import { BUSINESS_MODULES } from "@/modules/registry";
import type {
  Company,
  CompanyMember,
  Order,
  Plan,
  PlanUsageRow,
  Profile,
  Sale,
  Subscription,
} from "@/types/database";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-CO", { day: "2-digit", month: "long", year: "numeric" });
}

export default async function AdminEmpresaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: companyId } = await params;
  const supabase = await createClient();

  const [
    { data: companyData },
    { data: subscriptionData },
    { data: ownerData },
    { data: usageData },
    { data: salesData },
    { data: ordersData },
    { data: plansData },
  ] = await Promise.all([
    supabase.from("companies").select("*").eq("id", companyId).single(),
    supabase.from("subscriptions").select("*, plan:plans(*)").eq("company_id", companyId).maybeSingle(),
    supabase
      .from("company_members")
      .select("*, profile:profiles(*)")
      .eq("company_id", companyId)
      .eq("role", "owner")
      .maybeSingle(),
    supabase.rpc("get_plan_usage", { p_company_id: companyId }),
    supabase
      .from("sales")
      .select("*, customer:customers(first_name,last_name)")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("orders")
      .select("*")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase.from("plans").select("*").eq("is_active", true).order("price_monthly_cents"),
  ]);

  const company = companyData as Company | null;
  if (!company) notFound();

  const subscription = subscriptionData as (Subscription & { plan: Plan | null }) | null;
  const owner = ownerData as (CompanyMember & { profile: Profile | null }) | null;
  const usage = (usageData ?? []) as PlanUsageRow[];
  const sales = (salesData ?? []) as (Sale & { customer: { first_name: string; last_name: string | null } | null })[];
  const orders = (ordersData ?? []) as Order[];
  const plans = (plansData ?? []) as Plan[];

  const businessModule = BUSINESS_MODULES.find((m) => m.type === company.business_type);
  const ownerName = owner?.profile
    ? [owner.profile.first_name, owner.profile.last_name].filter(Boolean).join(" ") || null
    : null;

  return (
    <div className="max-w-4xl">
      <Link
        href="/admin/empresas"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Empresas
      </Link>

      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <h1 className="font-heading text-xl font-semibold text-foreground">{company.name}</h1>
          {subscription && (
            <Badge variant={subscription.status === "active" ? "default" : "outline"}>
              {SUBSCRIPTION_STATUS_LABELS[subscription.status]}
            </Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          {businessModule ? `${businessModule.emoji} ${businessModule.name}` : company.business_type}
        </p>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-border bg-card p-4">
          <h2 className="mb-3 font-heading text-base font-semibold text-foreground">Información</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <InfoRow icon={Mail} label="Propietario" value={ownerName} />
            <InfoRow icon={Mail} label="Correo" value={owner?.profile?.email ?? null} />
            <InfoRow icon={Phone} label="Teléfono" value={owner?.profile?.phone ?? company.phone} />
            <InfoRow icon={MapPin} label="Ciudad" value={company.city} />
            <InfoRow icon={Calendar} label="Registro" value={formatDate(company.created_at)} />
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-4">
          <h2 className="mb-3 font-heading text-base font-semibold text-foreground">Suscripción</h2>
          {subscription ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <InfoRow icon={Calendar} label="Plan" value={subscription.plan?.name ?? "—"} />
              <InfoRow
                icon={Calendar}
                label="Estado"
                value={SUBSCRIPTION_STATUS_LABELS[subscription.status]}
              />
              <InfoRow icon={Calendar} label="Inicio" value={formatDate(subscription.start_date)} />
              {subscription.status === "trial" && (
                <InfoRow icon={Calendar} label="Prueba termina" value={formatDate(subscription.trial_ends_at)} />
              )}
              <InfoRow icon={Calendar} label="Fin" value={formatDate(subscription.end_date)} />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Esta empresa no tiene una suscripción.</p>
          )}

          <div className="mt-4 border-t border-border pt-4">
            <CompanyActionsPanel
              companyId={company.id}
              currentPlanId={subscription?.plan_id ?? null}
              currentStatus={subscription?.status ?? null}
              plans={plans}
              trialEndsAt={subscription?.trial_ends_at ?? null}
            />
          </div>
        </section>
      </div>

      <section className="mt-4 rounded-xl border border-border bg-card p-4">
        <h2 className="mb-3 font-heading text-base font-semibold text-foreground">Uso del plan</h2>
        {usage.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin datos de uso disponibles.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
        )}
      </section>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-border bg-card p-4">
          <h2 className="mb-3 font-heading text-base font-semibold text-foreground">Últimas ventas</h2>
          {sales.length === 0 ? (
            <EmptyState title="Sin ventas todavía" description="Las ventas de esta empresa aparecerán aquí." />
          ) : (
            <ul className="divide-y divide-border">
              {sales.map((s) => (
                <li key={s.id} className="flex items-center justify-between py-2 text-sm">
                  <div>
                    <p className="text-foreground">
                      {s.customer ? [s.customer.first_name, s.customer.last_name].filter(Boolean).join(" ") : "Cliente general"}
                    </p>
                    <p className="text-xs text-muted-foreground">{formatDate(s.created_at)}</p>
                  </div>
                  <span className="font-medium text-foreground">{formatCurrencyCents(s.total_cents)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-xl border border-border bg-card p-4">
          <h2 className="mb-3 font-heading text-base font-semibold text-foreground">Últimos pedidos</h2>
          {orders.length === 0 ? (
            <EmptyState title="Sin pedidos todavía" description="Los pedidos de esta empresa aparecerán aquí." />
          ) : (
            <ul className="divide-y divide-border">
              {orders.map((o) => (
                <li key={o.id} className="flex items-center justify-between py-2 text-sm">
                  <div>
                    <p className="text-foreground">
                      #{o.order_number} · {o.customer_name}
                    </p>
                    <p className="text-xs text-muted-foreground">{ORDER_STATUS_LABELS[o.status]}</p>
                  </div>
                  <span className="font-medium text-foreground">{formatCurrencyCents(o.total_cents)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Mail;
  label: string;
  value: string | null;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm text-foreground">{value || "—"}</p>
      </div>
    </div>
  );
}

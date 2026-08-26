import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Mail, MapPin, Phone, Receipt, ShoppingCart, ClipboardList, History } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/lib/auth/session";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/ui/empty-state";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/catalog/status-badge";
import { ToggleStatusButton } from "@/components/catalog/toggle-status-button";
import { CustomerFormSheet } from "@/components/clientes/customer-form-sheet";
import { setCustomerStatusAction } from "@/app/(app)/clientes/actions";
import { customerFullName, customerInitials } from "@/lib/catalog";
import { formatCurrencyCents } from "@/lib/format";
import type { Customer } from "@/types/database";

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSessionContext();
  if (!session) redirect("/login");
  if (!session.activeCompany) redirect("/onboarding");

  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("customers").select("*").eq("id", id).maybeSingle();
  const customer = data as Customer | null;
  if (!customer) notFound();

  return (
    <div className="max-w-3xl">
      <Link
        href="/clientes"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Clientes
      </Link>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Avatar className="size-12">
            <AvatarFallback className="bg-brand/15 text-sm font-semibold text-brand">
              {customerInitials(customer)}
            </AvatarFallback>
          </Avatar>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-heading text-xl font-semibold text-foreground">
                {customerFullName(customer)}
              </h1>
              <StatusBadge status={customer.status} />
            </div>
            <p className="text-sm text-muted-foreground">
              Cliente desde {new Date(customer.created_at).toLocaleDateString("es-CO", {
                month: "long",
                year: "numeric",
              })}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <CustomerFormSheet customer={customer} />
          <ToggleStatusButton
            status={customer.status}
            entityLabel="Cliente"
            onToggle={setCustomerStatusAction.bind(null, customer.id)}
          />
        </div>
      </div>

      <div className="mt-6 grid gap-3 rounded-xl border border-border bg-card p-4 sm:grid-cols-2">
        <InfoRow icon={Phone} label="Teléfono" value={customer.phone} />
        <InfoRow icon={Mail} label="Correo" value={customer.email} />
        <InfoRow icon={MapPin} label="Dirección" value={customer.address} />
        <InfoRow icon={MapPin} label="Ciudad" value={customer.city} />
      </div>

      {customer.notes && (
        <div className="mt-4 rounded-xl border border-border bg-muted/40 p-4 text-sm text-foreground">
          <p className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Notas
          </p>
          {customer.notes}
        </div>
      )}

      <div className="mt-6 grid grid-cols-3 gap-3">
        <StatCard label="Total de compras" value={formatCurrencyCents(0)} />
        <StatCard label="Pedidos" value="0" />
        <StatCard label="Última actividad" value="—" />
      </div>

      <Tabs defaultValue="ventas" className="mt-6">
        <TabsList>
          <TabsTrigger value="ventas">Ventas</TabsTrigger>
          <TabsTrigger value="pedidos">Pedidos</TabsTrigger>
          <TabsTrigger value="pagos">Pagos</TabsTrigger>
          <TabsTrigger value="historial">Historial</TabsTrigger>
        </TabsList>
        <TabsContent value="ventas" className="pt-4">
          <EmptyState
            icon={ShoppingCart}
            title="Sin ventas todavía"
            description="Las ventas de este cliente aparecerán aquí."
          />
        </TabsContent>
        <TabsContent value="pedidos" className="pt-4">
          <EmptyState
            icon={ClipboardList}
            title="Sin pedidos todavía"
            description="Los pedidos de este cliente aparecerán aquí."
          />
        </TabsContent>
        <TabsContent value="pagos" className="pt-4">
          <EmptyState
            icon={Receipt}
            title="Sin pagos todavía"
            description="Los pagos registrados de este cliente aparecerán aquí."
          />
        </TabsContent>
        <TabsContent value="historial" className="pt-4">
          <EmptyState
            icon={History}
            title="Sin actividad todavía"
            description="El historial completo de este cliente aparecerá aquí."
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Phone;
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

import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Car, Palette, Tag, User } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/lib/auth/session";
import { VehicleFormSheet } from "@/components/vehiculos/vehicle-form-sheet";
import { DeleteVehicleButton } from "@/components/vehiculos/delete-vehicle-button";
import { customerFullName } from "@/lib/catalog";
import type { Customer, Vehicle } from "@/types/database";

export default async function VehicleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSessionContext();
  if (!session) redirect("/login");
  if (!session.activeCompany) redirect("/onboarding");

  const { id } = await params;
  const supabase = await createClient();
  const [{ data }, { data: customersData }] = await Promise.all([
    supabase.from("vehicles").select("*, customers(*)").eq("id", id).maybeSingle(),
    supabase
      .from("customers")
      .select("*")
      .eq("company_id", session.activeCompany.id)
      .eq("status", "active")
      .order("first_name", { ascending: true }),
  ]);

  const vehicle = data as (Vehicle & { customers: Customer | null }) | null;
  if (!vehicle) notFound();

  const customers = (customersData ?? []) as Customer[];

  return (
    <div className="max-w-3xl">
      <Link
        href="/vehiculos"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Vehículos
      </Link>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex size-12 items-center justify-center rounded-full bg-brand/15 text-brand">
            <Car className="size-6" />
          </span>
          <div>
            <h1 className="font-heading text-xl font-semibold text-foreground">
              {vehicle.plate}
            </h1>
            <p className="text-sm text-muted-foreground">
              {[vehicle.brand, vehicle.model].filter(Boolean).join(" ") || "Sin marca ni modelo"}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <VehicleFormSheet vehicle={vehicle} customers={customers} />
          <DeleteVehicleButton vehicleId={vehicle.id} />
        </div>
      </div>

      <div className="mt-6 grid gap-3 rounded-xl border border-border bg-card p-4 sm:grid-cols-2">
        <InfoRow icon={Tag} label="Marca" value={vehicle.brand} />
        <InfoRow icon={Tag} label="Modelo" value={vehicle.model} />
        <InfoRow icon={Palette} label="Color" value={vehicle.color} />
        <InfoRow
          icon={User}
          label="Cliente"
          value={vehicle.customers ? customerFullName(vehicle.customers) : null}
          href={vehicle.customers ? `/clientes/${vehicle.customers.id}` : undefined}
        />
      </div>

      {vehicle.notes && (
        <div className="mt-4 rounded-xl border border-border bg-muted/40 p-4 text-sm text-foreground">
          <p className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Notas
          </p>
          {vehicle.notes}
        </div>
      )}
    </div>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
  href,
}: {
  icon: typeof Tag;
  label: string;
  value: string | null;
  href?: string;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        {value && href ? (
          <Link href={href} className="text-sm font-medium text-brand hover:underline">
            {value}
          </Link>
        ) : (
          <p className="text-sm text-foreground">{value || "—"}</p>
        )}
      </div>
    </div>
  );
}

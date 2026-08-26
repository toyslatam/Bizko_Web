import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Cake, Dna, PawPrint, User } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/lib/auth/session";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { PetFormSheet } from "@/components/mascotas/pet-form-sheet";
import { DeletePetButton } from "@/components/mascotas/delete-pet-button";
import { customerFullName } from "@/lib/catalog";
import type { Customer, Pet } from "@/types/database";

const SEX_LABELS: Record<string, string> = {
  male: "Macho",
  female: "Hembra",
};

export default async function PetDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSessionContext();
  if (!session) redirect("/login");
  if (!session.activeCompany) redirect("/onboarding");

  const { id } = await params;
  const supabase = await createClient();
  const [{ data: petData }, { data: customerData }] = await Promise.all([
    supabase.from("pets").select("*, customers(*)").eq("id", id).maybeSingle(),
    supabase
      .from("customers")
      .select("*")
      .eq("company_id", session.activeCompany.id)
      .eq("status", "active")
      .order("first_name", { ascending: true }),
  ]);

  const pet = petData as (Pet & { customers: Customer | null }) | null;
  if (!pet) notFound();

  const customers = (customerData ?? []) as Customer[];

  return (
    <div className="max-w-3xl">
      <Link
        href="/mascotas"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Mascotas
      </Link>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Avatar className="size-12">
            <AvatarFallback className="bg-brand/15 text-sm font-semibold text-brand">
              {pet.name.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <h1 className="font-heading text-xl font-semibold text-foreground">{pet.name}</h1>
            <p className="text-sm text-muted-foreground">
              Registrada desde{" "}
              {new Date(pet.created_at).toLocaleDateString("es-CO", {
                month: "long",
                year: "numeric",
              })}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <PetFormSheet pet={pet} customers={customers} />
          <DeletePetButton petId={pet.id} />
        </div>
      </div>

      <div className="mt-6 grid gap-3 rounded-xl border border-border bg-card p-4 sm:grid-cols-2">
        <InfoRow icon={PawPrint} label="Especie" value={pet.species} />
        <InfoRow icon={Dna} label="Raza" value={pet.breed} />
        <InfoRow icon={User} label="Sexo" value={pet.sex ? (SEX_LABELS[pet.sex] ?? pet.sex) : null} />
        <InfoRow
          icon={Cake}
          label="Fecha de nacimiento"
          value={
            pet.birth_date
              ? new Date(pet.birth_date).toLocaleDateString("es-CO", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })
              : null
          }
        />
      </div>

      <div className="mt-4 rounded-xl border border-border bg-card p-4">
        <p className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Dueño
        </p>
        {pet.customers ? (
          <Link
            href={`/clientes/${pet.customers.id}`}
            className="text-sm font-medium text-brand hover:underline"
          >
            {customerFullName(pet.customers)}
          </Link>
        ) : (
          <p className="text-sm text-muted-foreground">—</p>
        )}
      </div>

      {pet.notes && (
        <div className="mt-4 rounded-xl border border-border bg-muted/40 p-4 text-sm text-foreground">
          <p className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Notas
          </p>
          {pet.notes}
        </div>
      )}
    </div>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof PawPrint;
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

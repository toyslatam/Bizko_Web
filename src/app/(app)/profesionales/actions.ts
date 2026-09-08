"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessionContext, type SessionContext } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import type { CommissionType, EntityStatus } from "@/types/database";

export interface TimeOffInput {
  professionalId: string;
  startsAt: string;
  endsAt: string;
  reason: string;
}

export interface ProfessionalInput {
  name: string;
  photoUrl: string | null;
  specialty: string;
  workDays: number[];
  workStartTime: string;
  workEndTime: string;
}

type ActionResult =
  | { ok: true; id: string }
  | { error: string; fieldErrors?: Partial<Record<"name" | "workDays", string>> };

function validate(input: ProfessionalInput) {
  const fieldErrors: Partial<Record<"name" | "workDays", string>> = {};
  if (!input.name.trim()) fieldErrors.name = "El nombre es obligatorio.";
  if (input.workDays.length === 0) fieldErrors.workDays = "Selecciona al menos un día.";
  return fieldErrors;
}

type CatalogGuard = { error: string } | { session: SessionContext };

async function requireCatalogPermission(): Promise<CatalogGuard> {
  const session = await getSessionContext();
  if (!session?.activeCompany || !session.activeMembership) {
    return { error: "No encontramos tu negocio activo." };
  }
  if (!can(session.activeMembership.role, "catalogo.editar")) {
    return { error: "No tienes permiso para editar el catálogo." };
  }
  return { session };
}

export async function createProfessionalAction(input: ProfessionalInput): Promise<ActionResult> {
  const fieldErrors = validate(input);
  if (Object.keys(fieldErrors).length > 0) return { error: "Revisa los campos.", fieldErrors };

  const guard = await requireCatalogPermission();
  if ("error" in guard) return guard;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("professionals")
    .insert({
      company_id: guard.session.activeCompany!.id,
      name: input.name.trim(),
      photo_url: input.photoUrl,
      specialty: input.specialty.trim() || null,
      work_days: input.workDays,
      work_start_time: input.workStartTime,
      work_end_time: input.workEndTime,
    })
    .select("id")
    .single();

  if (error || !data) return { error: "No pudimos crear el profesional." };

  revalidatePath("/profesionales");
  return { ok: true, id: data.id };
}

export async function updateProfessionalAction(
  id: string,
  input: ProfessionalInput,
): Promise<ActionResult> {
  const fieldErrors = validate(input);
  if (Object.keys(fieldErrors).length > 0) return { error: "Revisa los campos.", fieldErrors };

  const guard = await requireCatalogPermission();
  if ("error" in guard) return guard;

  const supabase = await createClient();
  const { error } = await supabase
    .from("professionals")
    .update({
      name: input.name.trim(),
      photo_url: input.photoUrl,
      specialty: input.specialty.trim() || null,
      work_days: input.workDays,
      work_start_time: input.workStartTime,
      work_end_time: input.workEndTime,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) return { error: "No pudimos guardar los cambios." };

  revalidatePath("/profesionales");
  revalidatePath(`/profesionales/${id}`);
  return { ok: true, id };
}

export async function setProfessionalStatusAction(
  id: string,
  status: EntityStatus,
): Promise<{ ok: true } | { error: string }> {
  const guard = await requireCatalogPermission();
  if ("error" in guard) return guard;

  const supabase = await createClient();
  const { error } = await supabase
    .from("professionals")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return { error: "No pudimos actualizar el estado." };

  revalidatePath("/profesionales");
  revalidatePath(`/profesionales/${id}`);
  return { ok: true };
}

export async function assignServiceToProfessionalAction(
  professionalId: string,
  serviceId: string,
): Promise<{ ok: true } | { error: string }> {
  const guard = await requireCatalogPermission();
  if ("error" in guard) return guard;

  const supabase = await createClient();
  const { error } = await supabase
    .from("service_professionals")
    .insert({ professional_id: professionalId, service_id: serviceId });

  if (error) return { error: "No pudimos asignar el servicio." };

  revalidatePath(`/profesionales/${professionalId}`);
  revalidatePath(`/servicios/${serviceId}`);
  return { ok: true };
}

export async function unassignServiceFromProfessionalAction(
  professionalId: string,
  serviceId: string,
): Promise<{ ok: true } | { error: string }> {
  const guard = await requireCatalogPermission();
  if ("error" in guard) return guard;

  const supabase = await createClient();
  const { error } = await supabase
    .from("service_professionals")
    .delete()
    .eq("professional_id", professionalId)
    .eq("service_id", serviceId);

  if (error) return { error: "No pudimos quitar el servicio." };

  revalidatePath(`/profesionales/${professionalId}`);
  revalidatePath(`/servicios/${serviceId}`);
  return { ok: true };
}

export async function upsertCommissionRuleAction(
  professionalId: string,
  serviceId: string | null,
  commissionType: CommissionType,
  value: string,
): Promise<{ ok: true } | { error: string }> {
  const guard = await requireCatalogPermission();
  if ("error" in guard) return guard;

  const normalized = value.replace(/,/g, ".").trim();
  const n = Number(normalized);
  if (normalized === "" || Number.isNaN(n) || n < 0) {
    return { error: "El valor de la comisión no es válido." };
  }
  const storedValue = commissionType === "fixed" ? Math.round(n * 100) : n;

  const supabase = await createClient();

  // Postgres considera cada NULL distinto en un índice único, así que
  // ON CONFLICT no detecta duplicados cuando service_id es null (comisión
  // por defecto) — se resuelve a mano: buscar la fila existente y
  // actualizarla, o insertar si no existe.
  let existingQuery = supabase
    .from("commission_rules")
    .select("id")
    .eq("professional_id", professionalId);
  existingQuery = serviceId === null ? existingQuery.is("service_id", null) : existingQuery.eq("service_id", serviceId);
  const { data: existing } = await existingQuery.maybeSingle();

  const error = existing
    ? (
        await supabase
          .from("commission_rules")
          .update({ commission_type: commissionType, value: storedValue })
          .eq("id", existing.id)
      ).error
    : (
        await supabase.from("commission_rules").insert({
          company_id: guard.session.activeCompany!.id,
          professional_id: professionalId,
          service_id: serviceId,
          commission_type: commissionType,
          value: storedValue,
        })
      ).error;

  if (error) return { error: "No pudimos guardar la comisión." };

  revalidatePath(`/profesionales/${professionalId}`);
  return { ok: true };
}

export async function deleteCommissionRuleAction(
  id: string,
  professionalId: string,
): Promise<{ ok: true } | { error: string }> {
  const guard = await requireCatalogPermission();
  if ("error" in guard) return guard;

  const supabase = await createClient();
  const { error } = await supabase.from("commission_rules").delete().eq("id", id);

  if (error) return { error: "No pudimos eliminar la comisión." };

  revalidatePath(`/profesionales/${professionalId}`);
  return { ok: true };
}

export async function createTimeOffAction(
  input: TimeOffInput,
): Promise<{ ok: true } | { error: string }> {
  const guard = await requireCatalogPermission();
  if ("error" in guard) return guard;

  if (!input.startsAt || !input.endsAt) {
    return { error: "Selecciona la fecha y hora de inicio y fin." };
  }
  if (new Date(input.endsAt).getTime() <= new Date(input.startsAt).getTime()) {
    return { error: "La hora de fin debe ser posterior a la de inicio." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("professional_time_off").insert({
    professional_id: input.professionalId,
    starts_at: input.startsAt,
    ends_at: input.endsAt,
    reason: input.reason.trim() || null,
  });

  if (error) return { error: "No pudimos guardar el bloqueo." };

  revalidatePath(`/profesionales/${input.professionalId}`);
  return { ok: true };
}

export async function deleteTimeOffAction(
  id: string,
  professionalId: string,
): Promise<{ ok: true } | { error: string }> {
  const guard = await requireCatalogPermission();
  if ("error" in guard) return guard;

  const supabase = await createClient();
  const { error } = await supabase.from("professional_time_off").delete().eq("id", id);

  if (error) return { error: "No pudimos eliminar el bloqueo." };

  revalidatePath(`/profesionales/${professionalId}`);
  return { ok: true };
}

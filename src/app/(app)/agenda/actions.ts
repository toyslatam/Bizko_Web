"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/lib/auth/session";
import type { AppointmentStatus } from "@/types/database";

export interface AppointmentInput {
  appointmentDate: string;
  startTime: string;
  endTime: string;
  customerId: string;
  serviceId: string;
  employeeId: string;
  notes: string;
}

type ActionResult =
  | { ok: true; id: string }
  | { error: string; fieldErrors?: Partial<Record<keyof AppointmentInput, string>> };

function validate(input: AppointmentInput): Partial<Record<keyof AppointmentInput, string>> {
  const errors: Partial<Record<keyof AppointmentInput, string>> = {};
  if (!input.appointmentDate.trim()) errors.appointmentDate = "La fecha es obligatoria.";
  if (!input.startTime.trim()) errors.startTime = "La hora de inicio es obligatoria.";
  return errors;
}

export async function createAppointmentAction(input: AppointmentInput): Promise<ActionResult> {
  const fieldErrors = validate(input);
  if (Object.keys(fieldErrors).length > 0) return { error: "Revisa los campos.", fieldErrors };

  const session = await getSessionContext();
  if (!session?.activeCompany) return { error: "No encontramos tu negocio activo." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("appointments")
    .insert({
      company_id: session.activeCompany.id,
      appointment_date: input.appointmentDate,
      start_time: input.startTime,
      end_time: input.endTime || null,
      customer_id: input.customerId || null,
      service_id: input.serviceId || null,
      employee_id: input.employeeId || null,
      notes: input.notes.trim() || null,
    })
    .select("id")
    .single();

  if (error || !data) return { error: "No pudimos crear la cita." };

  revalidatePath("/agenda");
  revalidatePath("/dashboard");
  return { ok: true, id: data.id };
}

export async function setAppointmentStatusAction(
  id: string,
  status: AppointmentStatus,
): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("appointments")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return { error: "No pudimos actualizar el estado." };

  revalidatePath("/agenda");
  return { ok: true };
}

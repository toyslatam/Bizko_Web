"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/lib/auth/session";
import type { AppointmentStatus, PaymentMethod, Sale } from "@/types/database";

export interface AppointmentInput {
  appointmentDate: string;
  startTime: string;
  customerId: string;
  serviceId: string;
  professionalId: string;
  notes: string;
}

type ActionResult =
  | { ok: true; id: string }
  | { error: string; fieldErrors?: Partial<Record<keyof AppointmentInput, string>> };

function rpcErrorMessage(error: { message: string } | null, fallback: string): string {
  return error?.message || fallback;
}

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
    .rpc("create_appointment_v2", {
      p_company_id: session.activeCompany.id,
      p_customer_id: input.customerId || null,
      p_service_id: input.serviceId || null,
      p_professional_id: input.professionalId || null,
      p_appointment_date: input.appointmentDate,
      p_start_time: input.startTime,
      p_notes: input.notes.trim() || null,
    })
    .single();

  if (error || !data) return { error: rpcErrorMessage(error, "No pudimos crear la cita.") };

  revalidatePath("/agenda");
  revalidatePath("/dashboard");
  return { ok: true, id: (data as { id: string }).id };
}

export async function setAppointmentStatusAction(
  id: string,
  status: AppointmentStatus,
): Promise<{ ok: true } | { error: string }> {
  if (status === "completed") {
    return { error: 'Usa "Completar y cobrar" para finalizar una cita.' };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("appointments")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return { error: "No pudimos actualizar el estado." };

  revalidatePath("/agenda");
  return { ok: true };
}

export interface RescheduleInput {
  appointmentId: string;
  appointmentDate: string;
  startTime: string;
  professionalId: string;
}

export async function rescheduleAppointmentAction(
  input: RescheduleInput,
): Promise<{ ok: true } | { error: string }> {
  if (!input.appointmentDate.trim() || !input.startTime.trim()) {
    return { error: "La fecha y la hora son obligatorias." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .rpc("reschedule_appointment", {
      p_appointment_id: input.appointmentId,
      p_appointment_date: input.appointmentDate,
      p_start_time: input.startTime,
      p_professional_id: input.professionalId || null,
    })
    .single();

  if (error) return { error: rpcErrorMessage(error, "No pudimos reprogramar la cita.") };

  revalidatePath("/agenda");
  return { ok: true };
}

export interface CompleteAppointmentInput {
  appointmentId: string;
  paymentMethod: PaymentMethod;
  extraItems: { productId: string; quantity: number }[];
  /** Lo que hizo el profesional (tono usado, diseño, tratamiento) — historial de belleza del cliente. */
  serviceNotes?: string;
}

type CompleteResult = { ok: true; saleId: string; totalCents: number } | { error: string };

export async function completeAndPayAppointmentAction(
  input: CompleteAppointmentInput,
): Promise<CompleteResult> {
  const session = await getSessionContext();
  if (!session?.activeCompany) return { error: "No encontramos tu negocio activo." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("complete_and_pay_appointment", {
      p_appointment_id: input.appointmentId,
      p_payment_method: input.paymentMethod,
      p_extra_items: input.extraItems.map((item) => ({
        product_id: item.productId,
        quantity: item.quantity,
      })),
      p_service_notes: input.serviceNotes?.trim() || null,
    })
    .single();

  if (error || !data) {
    return { error: rpcErrorMessage(error, "No pudimos completar y cobrar la cita.") };
  }

  const sale = data as Sale;
  revalidatePath("/agenda");
  revalidatePath("/ventas");
  revalidatePath("/dashboard");
  revalidatePath("/caja");
  return { ok: true, saleId: sale.id, totalCents: sale.total_cents };
}

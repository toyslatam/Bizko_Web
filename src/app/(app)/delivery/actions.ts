"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import type { DeliveryDriverStatus, DeliveryStatus } from "@/types/database";

type ActionResult<T extends object = object> = ({ ok: true } & T) | { error: string };

function rpcError(error: { message: string } | null, fallback: string): string {
  return error?.message || fallback;
}

// ---------------------------------------------------------------------------
// Zonas
// ---------------------------------------------------------------------------
export interface ZoneInput {
  name: string;
  description: string;
  deliveryFee: string;
  minimumOrder: string;
  estimatedTime: string;
}

function parseMoneyToCents(value: string): number {
  const n = Number(value.replace(/,/g, ".").trim() || "0");
  return Number.isNaN(n) || n < 0 ? 0 : Math.round(n * 100);
}

export async function createZoneAction(input: ZoneInput): Promise<ActionResult<{ id: string }>> {
  if (!input.name.trim()) return { error: "El nombre de la zona es obligatorio." };
  const session = await getSessionContext();
  if (!session?.activeCompany || !session.activeMembership) return { error: "No encontramos tu negocio activo." };
  if (!can(session.activeMembership.role, "delivery.configurar")) {
    return { error: "No tienes permiso para configurar delivery." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("delivery_zones")
    .insert({
      company_id: session.activeCompany.id,
      name: input.name.trim(),
      description: input.description.trim() || null,
      delivery_fee_cents: parseMoneyToCents(input.deliveryFee),
      minimum_order_cents: parseMoneyToCents(input.minimumOrder),
      estimated_time: input.estimatedTime.trim() || null,
    })
    .select("id")
    .single();

  if (error || !data) return { error: "No pudimos crear la zona." };
  revalidatePath("/delivery/zonas");
  return { ok: true, id: data.id };
}

export async function updateZoneAction(id: string, input: ZoneInput): Promise<ActionResult> {
  if (!input.name.trim()) return { error: "El nombre de la zona es obligatorio." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("delivery_zones")
    .update({
      name: input.name.trim(),
      description: input.description.trim() || null,
      delivery_fee_cents: parseMoneyToCents(input.deliveryFee),
      minimum_order_cents: parseMoneyToCents(input.minimumOrder),
      estimated_time: input.estimatedTime.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) return { error: "No pudimos guardar los cambios." };
  revalidatePath("/delivery/zonas");
  return { ok: true };
}

export async function setZoneActiveAction(id: string, isActive: boolean): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("delivery_zones")
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return { error: "No pudimos actualizar la zona." };
  revalidatePath("/delivery/zonas");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Barrios / sectores
// ---------------------------------------------------------------------------
export async function createAreaAction(zoneId: string, name: string): Promise<ActionResult<{ id: string }>> {
  if (!name.trim()) return { error: "El nombre del barrio es obligatorio." };
  const session = await getSessionContext();
  if (!session?.activeCompany) return { error: "No encontramos tu negocio activo." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("delivery_areas")
    .insert({ company_id: session.activeCompany.id, delivery_zone_id: zoneId, name: name.trim() })
    .select("id")
    .single();

  if (error || !data) return { error: "No pudimos agregar el barrio." };
  revalidatePath("/delivery/zonas");
  return { ok: true, id: data.id };
}

export async function deleteAreaAction(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("delivery_areas").delete().eq("id", id);
  if (error) return { error: "No pudimos eliminar el barrio." };
  revalidatePath("/delivery/zonas");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Repartidores
// ---------------------------------------------------------------------------
export interface DriverInput {
  name: string;
  phone: string;
}

export async function createDriverAction(input: DriverInput): Promise<ActionResult<{ id: string }>> {
  if (!input.name.trim() || !input.phone.trim()) return { error: "Nombre y teléfono son obligatorios." };
  const session = await getSessionContext();
  if (!session?.activeCompany) return { error: "No encontramos tu negocio activo." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("delivery_drivers")
    .insert({ company_id: session.activeCompany.id, name: input.name.trim(), phone: input.phone.trim() })
    .select("id")
    .single();

  if (error || !data) return { error: "No pudimos crear el repartidor." };
  revalidatePath("/delivery/repartidores");
  revalidatePath("/delivery");
  return { ok: true, id: data.id };
}

export async function updateDriverAction(id: string, input: DriverInput): Promise<ActionResult> {
  if (!input.name.trim() || !input.phone.trim()) return { error: "Nombre y teléfono son obligatorios." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("delivery_drivers")
    .update({ name: input.name.trim(), phone: input.phone.trim(), updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return { error: "No pudimos guardar los cambios." };
  revalidatePath("/delivery/repartidores");
  return { ok: true };
}

export async function setDriverStatusAction(id: string, status: DeliveryDriverStatus): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("delivery_drivers")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return { error: "No pudimos actualizar el estado." };
  revalidatePath("/delivery/repartidores");
  revalidatePath("/delivery");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Operación: asignar repartidor y cambiar estado del delivery
// ---------------------------------------------------------------------------
export async function assignDriverAction(orderId: string, driverId: string | null): Promise<ActionResult> {
  const session = await getSessionContext();
  if (!session?.activeMembership) return { error: "No encontramos tu sesión." };
  if (!can(session.activeMembership.role, "delivery.gestionar")) {
    return { error: "No tienes permiso para asignar repartidores." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .rpc("assign_delivery_driver", { p_order_id: orderId, p_driver_id: driverId })
    .single();

  if (error) return { error: rpcError(error, "No pudimos asignar el repartidor.") };
  revalidatePath("/delivery");
  revalidatePath(`/pedidos/${orderId}`);
  revalidatePath("/pedidos");
  return { ok: true };
}

export async function setDeliveryStatusAction(
  orderId: string,
  status: DeliveryStatus,
  failureReason = "",
  paymentReceived = false,
): Promise<ActionResult> {
  const session = await getSessionContext();
  if (!session?.activeMembership) return { error: "No encontramos tu sesión." };
  if (!can(session.activeMembership.role, "delivery.gestionar")) {
    return { error: "No tienes permiso para gestionar la entrega." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .rpc("set_delivery_status", {
      p_order_id: orderId,
      p_status: status,
      p_failure_reason: failureReason,
      p_payment_received: paymentReceived,
    })
    .single();

  if (error) return { error: rpcError(error, "No pudimos actualizar la entrega.") };
  revalidatePath("/delivery");
  revalidatePath(`/pedidos/${orderId}`);
  revalidatePath("/pedidos");
  revalidatePath("/dashboard");
  revalidatePath("/caja");
  return { ok: true };
}

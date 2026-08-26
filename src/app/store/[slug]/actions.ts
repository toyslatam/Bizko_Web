"use server";

import { createClient } from "@/lib/supabase/server";
import type { OrderFulfillment } from "@/types/database";

export interface PublicOrderItemInput {
  productId: string;
  variantId: string | null;
  quantity: number;
  /** IDs de las opciones de modificador elegidas — create_public_order() las tarifa en el servidor. */
  modifierOptionIds: string[];
  notes: string | null;
}

export interface CheckoutInput {
  slug: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  deliveryType: OrderFulfillment;
  deliveryAddress: string;
  deliveryCity: string;
  deliveryNeighborhood: string;
  deliveryReference: string;
  deliveryAreaId: string | null;
  recipientName: string;
  recipientPhone: string;
  notes: string;
  items: PublicOrderItemInput[];
}

type CheckoutResult = { ok: true; orderId: string } | { error: string };

/**
 * Server Action pública (sin sesión): cualquier visitante del catálogo la
 * puede llamar. Toda la validación real (stock, precios, zona, pedido
 * mínimo, pertenencia a la empresa) ocurre dentro de create_public_order()
 * en Postgres — esta acción es solo el puente hacia esa RPC, nunca confiar
 * en montos calculados en el navegador.
 */
export async function createPublicOrderAction(input: CheckoutInput): Promise<CheckoutResult> {
  if (input.items.length === 0) return { error: "Tu carrito está vacío." };

  const supabase = await createClient();
  // create_public_order() devuelve un uuid escalar, no una fila — sin .single().
  const { data, error } = await supabase.rpc("create_public_order", {
    p_company_slug: input.slug,
    p_customer_name: input.customerName,
    p_customer_phone: input.customerPhone,
    p_customer_email: input.customerEmail,
    p_delivery_type: input.deliveryType,
    p_delivery_address: input.deliveryAddress,
    p_delivery_city: input.deliveryCity,
    p_delivery_neighborhood: input.deliveryNeighborhood,
    p_delivery_reference: input.deliveryReference,
    p_delivery_area_id: input.deliveryAreaId,
    p_recipient_name: input.recipientName,
    p_recipient_phone: input.recipientPhone,
    p_notes: input.notes,
    p_items: input.items.map((i) => ({
      product_id: i.productId,
      variant_id: i.variantId,
      quantity: i.quantity,
      modifiers: i.modifierOptionIds.map((id) => ({ option_id: id })),
      notes: i.notes,
    })),
  });

  if (error || !data) {
    return { error: error?.message || "No pudimos enviar tu pedido. Intenta de nuevo." };
  }

  return { ok: true, orderId: data as string };
}

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import type { PaymentMethod, SaleItemType } from "@/types/database";

export interface CartItemInput {
  itemType: SaleItemType;
  productId: string | null;
  serviceId: string | null;
  variantId: string | null;
  name: string;
  quantity: number;
  unitPriceCents: number;
  discountCents: number;
}

export interface CreateSaleInput {
  customerId: string | null;
  paymentMethod: PaymentMethod;
  discountCents: number;
  notes: string;
  items: CartItemInput[];
}

type CreateSaleResult =
  | { ok: true; id: string; saleNumber: string }
  | { error: string };

// Los mensajes de las funciones SQL (raise exception) ya están en español y
// pensados para mostrarse tal cual al usuario (ej. "No hay suficiente
// inventario disponible. Stock actual: 3.").
function rpcErrorMessage(error: { message: string } | null, fallback: string): string {
  return error?.message || fallback;
}

export async function createSaleAction(input: CreateSaleInput): Promise<CreateSaleResult> {
  if (input.items.length === 0) {
    return { error: "Agrega al menos un producto o servicio." };
  }

  const session = await getSessionContext();
  if (!session?.activeCompany) return { error: "No encontramos tu negocio activo." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("create_sale", {
      p_company_id: session.activeCompany.id,
      p_customer_id: input.customerId,
      p_payment_method: input.paymentMethod,
      p_discount_cents: input.discountCents,
      p_notes: input.notes,
      p_items: input.items.map((item) => ({
        item_type: item.itemType,
        product_id: item.productId,
        service_id: item.serviceId,
        variant_id: item.variantId,
        name: item.name,
        quantity: item.quantity,
        unit_price_cents: item.unitPriceCents,
        discount_cents: item.discountCents,
      })),
    })
    .single();

  if (error || !data) {
    return { error: rpcErrorMessage(error, "No pudimos registrar la venta. Intenta de nuevo.") };
  }

  const sale = data as { id: string; sale_number: string };
  revalidatePath("/ventas");
  revalidatePath("/dashboard");
  revalidatePath("/inventario");
  return { ok: true, id: sale.id, saleNumber: sale.sale_number };
}

export async function voidSaleAction(id: string): Promise<{ ok: true } | { error: string }> {
  const session = await getSessionContext();
  if (!session?.activeMembership) return { error: "No encontramos tu sesión." };
  if (!can(session.activeMembership.role, "ventas.anular")) {
    return { error: "No tienes permiso para anular ventas." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("void_sale", { p_sale_id: id }).single();

  if (error) return { error: rpcErrorMessage(error, "No pudimos anular la venta.") };

  revalidatePath("/ventas");
  revalidatePath(`/ventas/${id}`);
  revalidatePath("/dashboard");
  revalidatePath("/inventario");
  return { ok: true };
}

"use client";

import * as React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CustomerCombobox } from "@/components/ventas/customer-combobox";
import { createSaleAction } from "@/app/(app)/ventas/actions";
import { PAYMENT_METHOD_LABELS } from "@/lib/sales";
import { formatCurrencyCents } from "@/lib/format";
import type { Customer, PaymentMethod } from "@/types/database";

export function QrSaleForm({
  productId,
  variantId,
  name,
  detail,
  imageUrl,
  priceCents,
  customers,
  canSell,
}: {
  productId: string;
  variantId: string | null;
  name: string;
  detail: string;
  imageUrl: string | null;
  priceCents: number;
  customers: Customer[];
  canSell: boolean;
}) {
  const router = useRouter();
  const [quantity, setQuantity] = React.useState(1);
  // "" = Cliente general, que es el caso normal al escanear en el mostrador.
  const [customerId, setCustomerId] = React.useState("");
  const [paymentMethod, setPaymentMethod] = React.useState<PaymentMethod>("cash");
  const [saving, setSaving] = React.useState(false);

  const totalCents = priceCents * quantity;

  async function handleConfirm() {
    setSaving(true);
    const result = await createSaleAction({
      customerId: customerId || null,
      paymentMethod,
      discountCents: 0,
      notes: "Venta por QR",
      items: [
        {
          itemType: "product",
          productId,
          serviceId: null,
          variantId,
          name: detail ? `${name} (${detail})` : name,
          quantity,
          unitPriceCents: priceCents,
          discountCents: 0,
        },
      ],
    });
    setSaving(false);

    if ("error" in result) {
      toast.error(result.error);
      return;
    }

    toast.success(`Venta ${result.saleNumber} registrada.`);
    router.push(`/ventas/${result.id}`);
  }

  return (
    <div className="mx-auto mt-6 max-w-md space-y-5">
      <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-card p-6 text-center">
        {imageUrl && (
          <Image
            src={imageUrl}
            alt={name}
            width={120}
            height={120}
            className="size-30 rounded-lg object-cover"
          />
        )}
        <div>
          <p className="font-heading text-xl font-semibold text-foreground">{name}</p>
          {detail && <p className="text-sm text-muted-foreground">{detail}</p>}
        </div>
        <p className="font-heading text-4xl font-bold text-foreground">
          {formatCurrencyCents(priceCents)}
        </p>
      </div>

      {canSell ? (
        <>
          <div className="space-y-1.5">
            <Label>Cantidad</Label>
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                disabled={quantity <= 1}
                aria-label="Quitar una unidad"
              >
                <Minus />
              </Button>
              <span className="min-w-10 text-center font-heading text-lg font-semibold text-foreground">
                {quantity}
              </span>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setQuantity((q) => q + 1)}
                aria-label="Agregar una unidad"
              >
                <Plus />
              </Button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Cliente</Label>
            <CustomerCombobox customers={customers} value={customerId} onChange={setCustomerId} />
          </div>

          <div className="space-y-1.5">
            <Label>Método de pago</Label>
            <Select
              value={paymentMethod}
              onValueChange={(value) => setPaymentMethod(value as PaymentMethod)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[]).map((method) => (
                  <SelectItem key={method} value={method}>
                    {PAYMENT_METHOD_LABELS[method]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button className="w-full" size="lg" onClick={handleConfirm} disabled={saving}>
            <Check />
            {saving ? "Registrando..." : `Confirmar venta · ${formatCurrencyCents(totalCents)}`}
          </Button>
        </>
      ) : (
        <p className="text-center text-sm text-muted-foreground">
          No tienes permiso para registrar ventas.
        </p>
      )}
    </div>
  );
}

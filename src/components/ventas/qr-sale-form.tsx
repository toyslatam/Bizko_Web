"use client";

import * as React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
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
import { cn } from "@/lib/utils";
import type { QrVariantOption } from "@/lib/qr";
import type { Customer, PaymentMethod } from "@/types/database";

export function QrSaleForm({
  productId,
  name,
  imageUrl,
  basePriceCents,
  variants,
  initialVariantId,
  customers,
  canSell,
  canEditPrice,
}: {
  productId: string;
  name: string;
  imageUrl: string | null;
  /** Precio del producto; solo se usa cuando no hay variantes. */
  basePriceCents: number;
  /** Vacío si el producto no tiene variantes. */
  variants: QrVariantOption[];
  /** Preselección desde `?v=`, para etiquetas impresas con el esquema viejo. */
  initialVariantId: string | null;
  customers: Customer[];
  canSell: boolean;
  canEditPrice: boolean;
}) {
  const router = useRouter();
  const hasVariants = variants.length > 0;

  // Con una sola variante no tiene sentido hacer elegir: se preselecciona.
  const [variantId, setVariantId] = React.useState<string | null>(() => {
    if (!hasVariants) return null;
    if (initialVariantId && variants.some((v) => v.id === initialVariantId)) {
      return initialVariantId;
    }
    return variants.length === 1 ? variants[0].id : null;
  });

  const selectedVariant = variants.find((v) => v.id === variantId) ?? null;
  const listPriceCents = selectedVariant ? selectedVariant.priceCents : basePriceCents;

  const [quantity, setQuantity] = React.useState(1);
  const [priceInput, setPriceInput] = React.useState((listPriceCents / 100).toString());
  // "" = Cliente general, que es el caso normal al escanear en el mostrador.
  const [customerId, setCustomerId] = React.useState("");
  const [paymentMethod, setPaymentMethod] = React.useState<PaymentMethod>("cash");
  const [saving, setSaving] = React.useState(false);

  // Cada variante tiene su propio precio, así que el campo editable sigue a la
  // selección. Se ajusta durante el render, no en un efecto, para que nunca se
  // pinte un precio que no corresponde a la variante elegida.
  const lastPriceRef = React.useRef(listPriceCents);
  if (lastPriceRef.current !== listPriceCents) {
    lastPriceRef.current = listPriceCents;
    setPriceInput((listPriceCents / 100).toString());
  }

  const parsedPriceCents = Math.round(Number(priceInput.replace(",", ".")) * 100);
  const effectivePriceCents =
    Number.isFinite(parsedPriceCents) && parsedPriceCents >= 0 ? parsedPriceCents : 0;
  const totalCents = effectivePriceCents * quantity;

  const needsVariant = hasVariants && !selectedVariant;

  async function handleConfirm() {
    if (needsVariant) {
      toast.error("Elige una variante.");
      return;
    }
    if (effectivePriceCents <= 0) {
      toast.error("Ingresa un precio válido.");
      return;
    }

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
          variantId: selectedVariant?.id ?? null,
          name: selectedVariant ? `${name} (${selectedVariant.label})` : name,
          quantity,
          unitPriceCents: effectivePriceCents,
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

  const shownImage = selectedVariant?.imageUrl ?? imageUrl;

  return (
    <div className="mx-auto mt-6 max-w-md space-y-5">
      <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-card p-6 text-center">
        {shownImage && (
          <Image
            src={shownImage}
            alt={name}
            width={120}
            height={120}
            className="size-30 rounded-lg object-cover"
          />
        )}
        <div>
          <p className="font-heading text-xl font-semibold text-foreground">{name}</p>
          {selectedVariant && (
            <p className="text-sm text-muted-foreground">{selectedVariant.label}</p>
          )}
        </div>
        <p className="font-heading text-4xl font-bold text-foreground">
          {needsVariant ? "—" : formatCurrencyCents(effectivePriceCents)}
        </p>
        {canEditPrice && !needsVariant && effectivePriceCents !== listPriceCents && (
          <p className="text-xs text-muted-foreground">
            Precio de lista: {formatCurrencyCents(listPriceCents)}
          </p>
        )}
      </div>

      {canSell ? (
        <>
          {hasVariants && (
            <div className="space-y-1.5">
              <Label>Variante</Label>
              <div className="grid grid-cols-2 gap-2">
                {variants.map((variant) => {
                  const active = variant.id === variantId;
                  const out = variant.stock <= 0;
                  return (
                    <button
                      key={variant.id}
                      type="button"
                      onClick={() => setVariantId(variant.id)}
                      className={cn(
                        "flex flex-col items-start gap-0.5 rounded-lg border p-3 text-left transition-colors",
                        active ? "border-brand bg-brand/10" : "border-border hover:bg-muted",
                      )}
                    >
                      <span className="text-sm font-medium text-foreground">{variant.label}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatCurrencyCents(variant.priceCents)}
                      </span>
                      <span
                        className={cn(
                          "text-xs",
                          out ? "text-destructive" : "text-muted-foreground",
                        )}
                      >
                        {out ? "Sin stock" : `${variant.stock} en stock`}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {canEditPrice && (
            <div className="space-y-1.5">
              <Label htmlFor="qrPrice">Precio unitario</Label>
              <Input
                id="qrPrice"
                inputMode="decimal"
                value={priceInput}
                onChange={(e) => setPriceInput(e.target.value)}
                disabled={needsVariant}
              />
            </div>
          )}

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

          <Button
            className="w-full"
            size="lg"
            onClick={handleConfirm}
            disabled={saving || needsVariant}
          >
            <Check />
            {needsVariant
              ? "Elige una variante"
              : saving
                ? "Registrando..."
                : `Confirmar venta · ${formatCurrencyCents(totalCents)}`}
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

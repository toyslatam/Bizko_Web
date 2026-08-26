"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Clock, Home, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCart } from "@/components/store/cart-context";
import { createPublicOrderAction } from "@/app/store/[slug]/actions";
import { formatCurrencyCents } from "@/lib/format";
import { UNIT_SHORT_LABELS } from "@/lib/catalog";
import { cn } from "@/lib/utils";
import type { OrderFulfillment, PublicDeliveryArea } from "@/types/database";

export function CheckoutForm({
  slug,
  pickupEnabled,
  deliveryEnabled,
  areas,
}: {
  slug: string;
  pickupEnabled: boolean;
  deliveryEnabled: boolean;
  areas: PublicDeliveryArea[];
}) {
  const router = useRouter();
  const { items, subtotalCents, clear } = useCart();

  const [deliveryType, setDeliveryType] = React.useState<OrderFulfillment>(
    deliveryEnabled ? "delivery" : "pickup",
  );
  const [name, setName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [address, setAddress] = React.useState("");
  const [city, setCity] = React.useState("");
  const [reference, setReference] = React.useState("");
  const [areaId, setAreaId] = React.useState<string>("");
  const [recipientName, setRecipientName] = React.useState("");
  const [recipientPhone, setRecipientPhone] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  const selectedArea = areas.find((a) => a.id === areaId) ?? null;
  const deliveryFeeCents = deliveryType === "delivery" ? (selectedArea?.delivery_fee_cents ?? 0) : 0;
  const totalCents = subtotalCents + deliveryFeeCents;
  const minimumOrderCents = deliveryType === "delivery" ? (selectedArea?.minimum_order_cents ?? 0) : 0;
  const belowMinimum = minimumOrderCents > 0 && subtotalCents < minimumOrderCents;

  React.useEffect(() => {
    if (items.length === 0) router.replace(`/store/${slug}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) {
      toast.error("Tu nombre y teléfono son obligatorios.");
      return;
    }
    if (deliveryType === "delivery" && !address.trim()) {
      toast.error("Ingresa tu dirección de entrega.");
      return;
    }
    if (belowMinimum) {
      toast.error(`El pedido mínimo para esta zona es de ${formatCurrencyCents(minimumOrderCents)}.`);
      return;
    }

    setSubmitting(true);
    const result = await createPublicOrderAction({
      slug,
      customerName: name,
      customerPhone: phone,
      customerEmail: email,
      deliveryType,
      deliveryAddress: address,
      deliveryCity: city,
      deliveryNeighborhood: selectedArea?.name ?? "",
      deliveryReference: reference,
      deliveryAreaId: areaId || null,
      recipientName,
      recipientPhone,
      notes,
      items: items.map((l) => ({
        productId: l.productId,
        variantId: l.variantId,
        quantity: l.quantity,
        modifierOptionIds: l.modifierOptionIds,
        notes: l.notes,
      })),
    });
    setSubmitting(false);

    if ("error" in result) {
      toast.error("No pudimos enviar tu pedido", { description: result.error });
      return;
    }

    clear();
    router.push(`/store/${slug}/pedido/${result.orderId}`);
  }

  if (items.length === 0) return null;

  return (
    <div>
      <Link
        href={`/store/${slug}/carrito`}
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Volver al carrito
      </Link>

      <form onSubmit={handleSubmit} className="space-y-5 pb-28">
        {(pickupEnabled || deliveryEnabled) && pickupEnabled && deliveryEnabled && (
          <section className="space-y-3 rounded-xl border border-border bg-card p-4">
            <h2 className="text-sm font-semibold text-foreground">¿Cómo quieres recibir tu pedido?</h2>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setDeliveryType("delivery")}
                className={cn(
                  "flex flex-col items-center gap-1.5 rounded-lg border p-3 text-sm font-medium",
                  deliveryType === "delivery" ? "border-brand bg-brand/5 text-brand" : "border-border text-muted-foreground",
                )}
              >
                <Home className="size-5" /> A domicilio
              </button>
              <button
                type="button"
                onClick={() => setDeliveryType("pickup")}
                className={cn(
                  "flex flex-col items-center gap-1.5 rounded-lg border p-3 text-sm font-medium",
                  deliveryType === "pickup" ? "border-brand bg-brand/5 text-brand" : "border-border text-muted-foreground",
                )}
              >
                <Store className="size-5" /> Recoger en el negocio
              </button>
            </div>
          </section>
        )}

        <section className="space-y-3 rounded-xl border border-border bg-card p-4">
          <h2 className="text-sm font-semibold text-foreground">Tus datos</h2>
          <div className="space-y-1.5">
            <Label htmlFor="checkoutName">Nombre</Label>
            <Input id="checkoutName" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="checkoutPhone">Teléfono</Label>
            <Input id="checkoutPhone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="300 123 4567" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="checkoutEmail">Correo (opcional)</Label>
            <Input id="checkoutEmail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
        </section>

        {deliveryType === "delivery" && (
          <section className="space-y-3 rounded-xl border border-border bg-card p-4">
            <h2 className="text-sm font-semibold text-foreground">Dirección de entrega</h2>

            {areas.length > 0 && (
              <div className="space-y-1.5">
                <Label>Barrio / sector</Label>
                <Select value={areaId} onValueChange={setAreaId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecciona tu barrio" />
                  </SelectTrigger>
                  <SelectContent>
                    {areas.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name} · {a.zone_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedArea && (
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span>Envío: {formatCurrencyCents(selectedArea.delivery_fee_cents)}</span>
                    {selectedArea.minimum_order_cents > 0 && (
                      <span>Pedido mínimo: {formatCurrencyCents(selectedArea.minimum_order_cents)}</span>
                    )}
                    {selectedArea.estimated_time && (
                      <span className="flex items-center gap-1">
                        <Clock className="size-3" /> {selectedArea.estimated_time}
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="checkoutAddress">Dirección</Label>
              <Input id="checkoutAddress" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Calle 10 # 20-30" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="checkoutCity">Ciudad</Label>
              <Input id="checkoutCity" value={city} onChange={(e) => setCity(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="checkoutReference">Referencia (opcional)</Label>
              <Input
                id="checkoutReference"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="Apto, color de la casa, punto de referencia..."
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="recipientName">Recibe (opcional)</Label>
                <Input
                  id="recipientName"
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  placeholder={name || "Nombre de quien recibe"}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="recipientPhone">Su teléfono (opcional)</Label>
                <Input
                  id="recipientPhone"
                  value={recipientPhone}
                  onChange={(e) => setRecipientPhone(e.target.value)}
                  placeholder={phone || "Teléfono de quien recibe"}
                />
              </div>
            </div>
          </section>
        )}

        <section className="space-y-3 rounded-xl border border-border bg-card p-4">
          <h2 className="text-sm font-semibold text-foreground">Notas (opcional)</h2>
          <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Instrucciones para tu pedido..." />
        </section>

        <section className="space-y-2 rounded-xl border border-border bg-card p-4">
          <h2 className="text-sm font-semibold text-foreground">Resumen</h2>
          {items.map((l) => (
            <div key={l.key} className="text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">
                  {l.quantity} {UNIT_SHORT_LABELS[l.unit]} {l.name}
                </span>
                <span className="text-foreground">{formatCurrencyCents(Math.round(l.priceCents * l.quantity))}</span>
              </div>
              {l.modifiers.length > 0 && (
                <p className="text-xs text-muted-foreground">{l.modifiers.map((m) => m.name).join(", ")}</p>
              )}
              {l.notes && <p className="text-xs italic text-muted-foreground">Nota: {l.notes}</p>}
            </div>
          ))}
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="text-foreground">{formatCurrencyCents(subtotalCents)}</span>
          </div>
          {deliveryType === "delivery" && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Entrega</span>
              <span className="text-foreground">{formatCurrencyCents(deliveryFeeCents)}</span>
            </div>
          )}
          <div className="flex items-center justify-between border-t border-border pt-2 font-heading text-base font-semibold text-foreground">
            <span>Total</span>
            <span>{formatCurrencyCents(totalCents)}</span>
          </div>
          {belowMinimum && (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
              El pedido mínimo para esta zona es de {formatCurrencyCents(minimumOrderCents)}.
            </p>
          )}
          <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
            Pagas al recibir tu pedido (contra entrega).
          </p>
        </section>

        <div className="fixed inset-x-0 bottom-0 border-t border-border bg-card px-4 py-3">
          <div className="mx-auto max-w-3xl">
            <Button type="submit" size="lg" className="h-11 w-full" disabled={submitting || belowMinimum}>
              {submitting ? "Enviando pedido..." : `Confirmar pedido · ${formatCurrencyCents(totalCents)}`}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}

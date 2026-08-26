"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Minus, Package, Plus, ShoppingCart, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { useCart } from "@/components/store/cart-context";
import { formatCurrencyCents } from "@/lib/format";
import { UNIT_SHORT_LABELS } from "@/lib/catalog";

export default function CartPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = React.use(params);
  const router = useRouter();
  const { items, subtotalCents, updateQuantity, removeItem } = useCart();

  function handleUpdate(key: string, quantity: number) {
    const result = updateQuantity(key, quantity);
    if ("error" in result) toast.error(result.error);
  }

  return (
    <div>
      <Link
        href={`/store/${slug}`}
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Seguir comprando
      </Link>

      <h1 className="mb-4 font-heading text-xl font-semibold text-foreground">Tu pedido</h1>

      {items.length === 0 ? (
        <EmptyState icon={ShoppingCart} title="Tu carrito está vacío" description="Agrega productos del catálogo para continuar." />
      ) : (
        <>
          <div className="divide-y divide-border rounded-xl border border-border bg-card">
            {items.map((line) => (
              <div key={line.key} className="flex items-center gap-3 p-3">
                <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted">
                  {line.imageUrl ? (
                    <Image src={line.imageUrl} alt="" width={48} height={48} className="size-full object-cover" />
                  ) : (
                    <Package className="size-5 text-muted-foreground" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{line.name}</p>
                  <p className="text-xs text-muted-foreground">{formatCurrencyCents(line.priceCents)} / {UNIT_SHORT_LABELS[line.unit]}</p>
                  {line.modifiers.length > 0 && (
                    <p className="truncate text-xs text-muted-foreground">
                      {line.modifiers.map((m) => m.name).join(", ")}
                    </p>
                  )}
                  {line.notes && (
                    <p className="truncate text-xs italic text-muted-foreground">Nota: {line.notes}</p>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleUpdate(line.key, Math.round((line.quantity - (line.unit === "unidad" ? 1 : 0.5)) * 100) / 100)}
                    className="flex size-7 items-center justify-center rounded-md border border-border text-muted-foreground"
                  >
                    <Minus className="size-3.5" />
                  </button>
                  <span className="w-10 text-center text-sm tabular-nums">{line.quantity}</span>
                  <button
                    type="button"
                    onClick={() => handleUpdate(line.key, Math.round((line.quantity + (line.unit === "unidad" ? 1 : 0.5)) * 100) / 100)}
                    className="flex size-7 items-center justify-center rounded-md border border-border text-muted-foreground"
                  >
                    <Plus className="size-3.5" />
                  </button>
                </div>
                <div className="flex w-20 shrink-0 flex-col items-end gap-1">
                  <span className="text-sm font-medium text-foreground">
                    {formatCurrencyCents(Math.round(line.priceCents * line.quantity))}
                  </span>
                  <button type="button" onClick={() => removeItem(line.key)} className="text-muted-foreground hover:text-destructive">
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="fixed inset-x-0 bottom-0 border-t border-border bg-card px-4 py-3">
            <div className="mx-auto flex max-w-3xl items-center justify-between gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Total</p>
                <p className="font-heading text-lg font-semibold text-foreground">
                  {formatCurrencyCents(subtotalCents)}
                </p>
              </div>
              <Button size="lg" className="h-11" onClick={() => router.push(`/store/${slug}/checkout`)}>
                Continuar
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

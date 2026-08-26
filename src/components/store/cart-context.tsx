"use client";

import * as React from "react";
import type { PublicProduct } from "@/types/database";

export interface CartVariantSelection {
  id: string;
  label: string;
  priceCents: number;
  stock: number;
  imageUrl: string | null;
}

/** Opción de modificador elegida al agregar al carrito (ver `addItem`). */
export interface CartModifierSelection {
  id: string;
  name: string;
  priceCents: number;
}

export interface CartLine {
  key: string;
  productId: string;
  variantId: string | null;
  name: string;
  imageUrl: string | null;
  unit: PublicProduct["unit"];
  priceCents: number;
  quantity: number;
  /** Para variantes siempre se valida contra su propio stock. */
  trackInventory: boolean;
  currentStock: number;
  /** Modificadores elegidos (comida) — el precio ya está incluido en `priceCents`. */
  modifiers: { name: string; priceCents: number }[];
  /** IDs de las opciones de modificador elegidas — para armar el payload del checkout. */
  modifierOptionIds: string[];
  notes: string | null;
}

interface CartContextValue {
  items: CartLine[];
  itemCount: number;
  subtotalCents: number;
  addItem: (
    product: PublicProduct,
    quantity: number,
    variant?: CartVariantSelection,
    extras?: { modifiers?: CartModifierSelection[]; notes?: string },
  ) => { ok: true } | { error: string };
  updateQuantity: (key: string, quantity: number) => { ok: true } | { error: string };
  removeItem: (key: string) => void;
  clear: () => void;
}

const CartContext = React.createContext<CartContextValue | null>(null);

function storageKey(slug: string) {
  return `bizko_cart_${slug}`;
}

export function CartProvider({ slug, children }: { slug: string; children: React.ReactNode }) {
  const [items, setItems] = React.useState<CartLine[]>([]);
  const hydrated = React.useRef(false);

  React.useEffect(() => {
    try {
      const raw = sessionStorage.getItem(storageKey(slug));
      // Hidratación única desde sessionStorage tras el montaje: sessionStorage
      // no existe en el servidor, así que esto no puede hacerse durante el render.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (raw) setItems(JSON.parse(raw));
    } catch {
      // sessionStorage no disponible (modo privado, etc.) — el carrito vive solo en memoria.
    }
    hydrated.current = true;
  }, [slug]);

  React.useEffect(() => {
    if (!hydrated.current) return;
    try {
      sessionStorage.setItem(storageKey(slug), JSON.stringify(items));
    } catch {
      // ignorar: mismo caso de arriba.
    }
  }, [items, slug]);

  const addItem = React.useCallback(
    (
      product: PublicProduct,
      quantity: number,
      variant?: CartVariantSelection,
      extras?: { modifiers?: CartModifierSelection[]; notes?: string },
    ) => {
      const modifiers = extras?.modifiers ?? [];
      const modifierOptionIds = modifiers.map((m) => m.id);
      const notes = extras?.notes?.trim() || null;
      const key = variant
        ? `${product.id}:${variant.id}`
        : modifierOptionIds.length > 0
          ? `${product.id}:${[...modifierOptionIds].sort().join(",")}`
          : product.id;
      const trackInventory = variant ? true : product.track_inventory;
      const currentStock = variant ? variant.stock : product.current_stock;
      const unitLabel = variant ? "und." : product.unit;
      const modifiersPriceCents = modifiers.reduce((s, m) => s + m.priceCents, 0);
      const effectivePriceCents = variant ? variant.priceCents : product.price_cents + modifiersPriceCents;

      let result: { ok: true } | { error: string } = { ok: true };
      setItems((prev) => {
        const existing = prev.find((l) => l.key === key);
        const nextQuantity = (existing?.quantity ?? 0) + quantity;

        if (trackInventory && nextQuantity > currentStock) {
          result = { error: `Solo quedan ${currentStock} ${unitLabel} disponibles.` };
          return prev;
        }

        if (existing) {
          return prev.map((l) =>
            l.key === key ? { ...l, quantity: nextQuantity, notes: notes ?? l.notes } : l,
          );
        }
        return [
          ...prev,
          {
            key,
            productId: product.id,
            variantId: variant?.id ?? null,
            name: variant ? `${product.name} (${variant.label})` : product.name,
            imageUrl: variant?.imageUrl ?? product.image_url,
            unit: product.unit,
            priceCents: effectivePriceCents,
            quantity,
            trackInventory,
            currentStock,
            modifiers: modifiers.map((m) => ({ name: m.name, priceCents: m.priceCents })),
            modifierOptionIds,
            notes,
          },
        ];
      });
      return result;
    },
    [],
  );

  const updateQuantity = React.useCallback((key: string, quantity: number) => {
    let result: { ok: true } | { error: string } = { ok: true };
    setItems((prev) => {
      const line = prev.find((l) => l.key === key);
      if (!line) return prev;
      if (quantity <= 0) return prev.filter((l) => l.key !== key);
      if (line.trackInventory && quantity > line.currentStock) {
        result = { error: `Solo quedan ${line.currentStock} disponibles.` };
        return prev;
      }
      return prev.map((l) => (l.key === key ? { ...l, quantity } : l));
    });
    return result;
  }, []);

  const removeItem = React.useCallback((key: string) => {
    setItems((prev) => prev.filter((l) => l.key !== key));
  }, []);

  const clear = React.useCallback(() => setItems([]), []);

  const itemCount = items.reduce((s, l) => s + l.quantity, 0);
  const subtotalCents = items.reduce((s, l) => s + Math.round(l.priceCents * l.quantity), 0);

  return (
    <CartContext.Provider
      value={{ items, itemCount, subtotalCents, addItem, updateQuantity, removeItem, clear }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = React.useContext(CartContext);
  if (!ctx) throw new Error("useCart debe usarse dentro de <CartProvider>");
  return ctx;
}

"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Minus, Plus, ShoppingCart, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { formatCurrencyCents } from "@/lib/format";
import { submitTableOrderAction } from "@/app/(app)/mesas/actions";
import type { ModifierGroup, ModifierOption, Product, ProductCategory } from "@/types/database";

type ProductWithModifiers = Product & {
  modifier_groups: (ModifierGroup & { modifier_options: ModifierOption[] })[];
};

interface CartLine {
  key: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPriceCents: number;
  notes: string;
  modifierOptionIds: string[];
  modifierNames: string[];
}

function lineKey(productId: string, modifierOptionIds: string[], notes: string): string {
  return `${productId}::${[...modifierOptionIds].sort().join(",")}::${notes.trim()}`;
}

export function TableOrderBuilder({
  tableId,
  products,
  categories,
}: {
  tableId: string;
  products: ProductWithModifiers[];
  categories: ProductCategory[];
}) {
  const router = useRouter();
  const [selectedCategory, setSelectedCategory] = React.useState<string | null>(null);
  const [cart, setCart] = React.useState<CartLine[]>([]);
  const [modifierProduct, setModifierProduct] = React.useState<ProductWithModifiers | null>(null);
  const [orderNotes, setOrderNotes] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [cartOpen, setCartOpen] = React.useState(false);

  const filteredProducts = selectedCategory
    ? products.filter((p) => p.category_id === selectedCategory)
    : products;

  function addLine(line: CartLine) {
    setCart((prev) => {
      const existing = prev.find((l) => l.key === line.key);
      if (existing) {
        return prev.map((l) => (l.key === line.key ? { ...l, quantity: l.quantity + line.quantity } : l));
      }
      return [...prev, line];
    });
  }

  function addSimpleProduct(product: ProductWithModifiers) {
    addLine({
      key: lineKey(product.id, [], ""),
      productId: product.id,
      productName: product.name,
      quantity: 1,
      unitPriceCents: product.price_cents,
      notes: "",
      modifierOptionIds: [],
      modifierNames: [],
    });
  }

  function updateQuantity(key: string, delta: number) {
    setCart((prev) =>
      prev
        .map((l) => (l.key === key ? { ...l, quantity: l.quantity + delta } : l))
        .filter((l) => l.quantity > 0),
    );
  }

  function removeLine(key: string) {
    setCart((prev) => prev.filter((l) => l.key !== key));
  }

  const itemCount = cart.reduce((sum, l) => sum + l.quantity, 0);
  const subtotalCents = cart.reduce((sum, l) => sum + l.quantity * l.unitPriceCents, 0);

  async function handleSubmit() {
    if (cart.length === 0) return;
    setSending(true);
    const result = await submitTableOrderAction(
      tableId,
      cart.map((l) => ({
        productId: l.productId,
        quantity: l.quantity,
        notes: l.notes || undefined,
        modifierOptionIds: l.modifierOptionIds,
      })),
      orderNotes || undefined,
    );
    setSending(false);

    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    toast.success("Pedido enviado a cocina.");
    setCart([]);
    setOrderNotes("");
    setCartOpen(false);
    router.refresh();
  }

  return (
    <div className="space-y-4 pb-20">
      {categories.length > 0 && (
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
          <button
            type="button"
            onClick={() => setSelectedCategory(null)}
            className={cn(
              "shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium whitespace-nowrap transition-colors",
              !selectedCategory
                ? "border-brand bg-brand text-white"
                : "border-border bg-card text-foreground hover:bg-muted",
            )}
          >
            Todos
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setSelectedCategory(c.id)}
              className={cn(
                "shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium whitespace-nowrap transition-colors",
                selectedCategory === c.id
                  ? "border-brand bg-brand text-white"
                  : "border-border bg-card text-foreground hover:bg-muted",
              )}
            >
              {c.name}
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {filteredProducts.map((product) => (
          <div
            key={product.id}
            className="flex flex-col justify-between gap-2 rounded-xl border border-border bg-card p-3"
          >
            <div>
              <p className="text-sm font-medium text-foreground">{product.name}</p>
              <p className="text-sm text-muted-foreground">{formatCurrencyCents(product.price_cents)}</p>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="self-end"
              onClick={() =>
                product.modifier_groups.length > 0 ? setModifierProduct(product) : addSimpleProduct(product)
              }
            >
              <Plus /> Agregar
            </Button>
          </div>
        ))}
        {filteredProducts.length === 0 && (
          <p className="col-span-full py-8 text-center text-sm text-muted-foreground">
            No hay productos en esta categoría.
          </p>
        )}
      </div>

      {modifierProduct && (
        <ModifierPickerDialog
          product={modifierProduct}
          onClose={() => setModifierProduct(null)}
          onConfirm={(line) => {
            addLine(line);
            setModifierProduct(null);
          }}
        />
      )}

      <Sheet open={cartOpen} onOpenChange={setCartOpen}>
        <SheetTrigger asChild>
          <Button
            className="fixed inset-x-4 bottom-4 z-40 flex items-center justify-between shadow-lg sm:inset-x-auto sm:right-4 sm:w-80"
            disabled={itemCount === 0}
          >
            <span className="flex items-center gap-2">
              <ShoppingCart className="size-4" /> {itemCount} {itemCount === 1 ? "producto" : "productos"}
            </span>
            <span>{formatCurrencyCents(subtotalCents)}</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Pedido de la mesa</SheetTitle>
          </SheetHeader>

          <div className="flex-1 space-y-3 overflow-y-auto px-4">
            {cart.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Todavía no agregas productos.</p>
            ) : (
              cart.map((line) => (
                <div key={line.key} className="flex items-start justify-between gap-3 rounded-lg border border-border p-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">{line.productName}</p>
                    {line.modifierNames.length > 0 && (
                      <p className="text-xs text-muted-foreground">{line.modifierNames.join(", ")}</p>
                    )}
                    {line.notes && <p className="text-xs text-muted-foreground">{line.notes}</p>}
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatCurrencyCents(line.unitPriceCents)} c/u
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <div className="flex items-center gap-1.5">
                      <Button size="icon-sm" variant="outline" onClick={() => updateQuantity(line.key, -1)}>
                        <Minus />
                      </Button>
                      <span className="w-5 text-center text-sm font-medium text-foreground">{line.quantity}</span>
                      <Button size="icon-sm" variant="outline" onClick={() => updateQuantity(line.key, 1)}>
                        <Plus />
                      </Button>
                    </div>
                    <Button size="icon-sm" variant="ghost" onClick={() => removeLine(line.key)}>
                      <Trash2 className="text-destructive" />
                    </Button>
                  </div>
                </div>
              ))
            )}

            {cart.length > 0 && (
              <div className="space-y-1.5">
                <Label htmlFor="orderNotes">Notas del pedido (opcional)</Label>
                <Textarea
                  id="orderNotes"
                  value={orderNotes}
                  onChange={(e) => setOrderNotes(e.target.value)}
                  placeholder="Ej. cliente frecuente, alergias, etc."
                />
              </div>
            )}
          </div>

          <SheetFooter>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Total estimado</span>
              <span className="font-heading text-base font-semibold text-foreground">
                {formatCurrencyCents(subtotalCents)}
              </span>
            </div>
            <Button onClick={handleSubmit} disabled={cart.length === 0 || sending}>
              {sending ? "Enviando..." : "Enviar a cocina"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function ModifierPickerDialog({
  product,
  onClose,
  onConfirm,
}: {
  product: ProductWithModifiers;
  onClose: () => void;
  onConfirm: (line: CartLine) => void;
}) {
  const [selections, setSelections] = React.useState<Record<string, string[]>>({});
  const [notes, setNotes] = React.useState("");

  const groups = [...product.modifier_groups].sort((a, b) => a.sort_order - b.sort_order);

  function toggleSingle(groupId: string, optionId: string) {
    setSelections((prev) => ({ ...prev, [groupId]: [optionId] }));
  }

  function toggleMultiple(group: ModifierGroup, optionId: string) {
    setSelections((prev) => {
      const current = prev[group.id] ?? [];
      if (current.includes(optionId)) {
        return { ...prev, [group.id]: current.filter((id) => id !== optionId) };
      }
      if (group.max_selections !== null && current.length >= group.max_selections) {
        return prev;
      }
      return { ...prev, [group.id]: [...current, optionId] };
    });
  }

  const missingRequired = groups.find((g) => {
    if (!g.is_required) return false;
    const count = (selections[g.id] ?? []).length;
    return count < Math.max(g.min_selections, 1);
  });

  function handleConfirm() {
    const selectedOptionIds = Object.values(selections).flat();
    const optionsById = new Map(
      groups.flatMap((g) => g.modifier_options.map((o) => [o.id, o] as const)),
    );
    const selectedOptions = selectedOptionIds
      .map((id) => optionsById.get(id))
      .filter((o): o is ModifierOption => Boolean(o));

    const unitPriceCents = product.price_cents + selectedOptions.reduce((sum, o) => sum + o.price_cents, 0);
    const trimmedNotes = notes.trim();

    onConfirm({
      key: lineKey(product.id, selectedOptionIds, trimmedNotes),
      productId: product.id,
      productName: product.name,
      quantity: 1,
      unitPriceCents,
      notes: trimmedNotes,
      modifierOptionIds: selectedOptionIds,
      modifierNames: selectedOptions.map((o) => o.name),
    });
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{product.name}</DialogTitle>
          <DialogDescription>{formatCurrencyCents(product.price_cents)}</DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] space-y-4 overflow-y-auto py-1">
          {groups.map((group) => (
            <div key={group.id} className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-foreground">
                  {group.name} {group.is_required && <span className="text-destructive">*</span>}
                </p>
                {group.selection_type === "multiple" && group.max_selections !== null && (
                  <span className="text-xs text-muted-foreground">máx. {group.max_selections}</span>
                )}
              </div>

              {group.selection_type === "single" ? (
                <div className="flex flex-wrap gap-2">
                  {[...group.modifier_options]
                    .sort((a, b) => a.sort_order - b.sort_order)
                    .map((option) => {
                      const selected = (selections[group.id] ?? []).includes(option.id);
                      return (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => toggleSingle(group.id, option.id)}
                          className={cn(
                            "rounded-full border px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors",
                            selected
                              ? "border-brand bg-brand text-white"
                              : "border-border bg-card text-foreground hover:bg-muted",
                          )}
                        >
                          {option.name}
                          {option.price_cents > 0 && ` (+${formatCurrencyCents(option.price_cents)})`}
                        </button>
                      );
                    })}
                </div>
              ) : (
                <div className="space-y-1.5">
                  {[...group.modifier_options]
                    .sort((a, b) => a.sort_order - b.sort_order)
                    .map((option) => {
                      const selected = (selections[group.id] ?? []).includes(option.id);
                      return (
                        <label
                          key={option.id}
                          className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm"
                        >
                          <Checkbox
                            checked={selected}
                            onCheckedChange={() => toggleMultiple(group, option.id)}
                          />
                          <span className="flex-1 text-foreground">{option.name}</span>
                          {option.price_cents > 0 && (
                            <span className="text-muted-foreground">
                              +{formatCurrencyCents(option.price_cents)}
                            </span>
                          )}
                        </label>
                      );
                    })}
                </div>
              )}
            </div>
          ))}

          <div className="space-y-1.5">
            <Label htmlFor="lineNotes">Observaciones (opcional)</Label>
            <Textarea
              id="lineNotes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ej. sin cebolla"
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleConfirm} disabled={Boolean(missingRequired)}>
            Agregar al pedido
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

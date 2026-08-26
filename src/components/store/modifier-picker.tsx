"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useCart } from "@/components/store/cart-context";
import { formatCurrencyCents } from "@/lib/format";
import { UNIT_SHORT_LABELS } from "@/lib/catalog";
import { cn } from "@/lib/utils";
import type { PublicModifierGroup, PublicModifierOption, PublicProduct } from "@/types/database";

const DECIMAL_UNITS = new Set(["kg", "litro", "libra", "g", "ml"]);

/**
 * Reemplaza a SimpleProductActions para productos sin variantes: cantidad +
 * modificadores (si el producto tiene) + notas — siempre coexisten.
 */
export function ModifierPicker({
  slug,
  product,
  modifierGroups,
  modifierOptions,
}: {
  slug: string;
  product: PublicProduct;
  modifierGroups: PublicModifierGroup[];
  modifierOptions: PublicModifierOption[];
}) {
  const router = useRouter();
  const { addItem } = useCart();
  const isDecimal = DECIMAL_UNITS.has(product.unit);
  const step = isDecimal ? 0.5 : 1;
  const [quantity, setQuantity] = React.useState(step);
  const [selections, setSelections] = React.useState<Record<string, string[]>>({});
  const [notes, setNotes] = React.useState("");
  const isOut = product.track_inventory && product.current_stock <= 0;

  const sortedGroups = React.useMemo(
    () => [...modifierGroups].sort((a, b) => a.sort_order - b.sort_order),
    [modifierGroups],
  );

  const optionsByGroup = React.useMemo(() => {
    const map = new Map<string, PublicModifierOption[]>();
    for (const o of modifierOptions) {
      const list = map.get(o.modifier_group_id) ?? [];
      list.push(o);
      map.set(o.modifier_group_id, list);
    }
    for (const list of map.values()) list.sort((a, b) => a.sort_order - b.sort_order);
    return map;
  }, [modifierOptions]);

  function toggleOption(group: PublicModifierGroup, optionId: string) {
    setSelections((prev) => {
      const current = prev[group.id] ?? [];
      if (group.selection_type === "single") {
        return { ...prev, [group.id]: current[0] === optionId ? [] : [optionId] };
      }
      if (current.includes(optionId)) {
        return { ...prev, [group.id]: current.filter((id) => id !== optionId) };
      }
      if (group.max_selections != null && current.length >= group.max_selections) {
        toast.error(`Puedes elegir máximo ${group.max_selections} opciones en "${group.name}".`);
        return prev;
      }
      return { ...prev, [group.id]: [...current, optionId] };
    });
  }

  function isGroupValid(group: PublicModifierGroup) {
    if (!group.is_required) return true;
    const count = (selections[group.id] ?? []).length;
    const min = group.selection_type === "single" ? 1 : Math.max(group.min_selections, 1);
    return count >= min;
  }

  const allValid = sortedGroups.every(isGroupValid);

  const selectedOptionsFlat = React.useMemo(() => {
    const list: PublicModifierOption[] = [];
    for (const group of sortedGroups) {
      const groupOptions = optionsByGroup.get(group.id) ?? [];
      for (const id of selections[group.id] ?? []) {
        const option = groupOptions.find((o) => o.id === id);
        if (option) list.push(option);
      }
    }
    return list;
  }, [sortedGroups, selections, optionsByGroup]);

  const modifiersTotalCents = selectedOptionsFlat.reduce((s, o) => s + o.price_cents, 0);
  const unitPriceCents = product.price_cents + modifiersTotalCents;
  const totalCents = Math.round(unitPriceCents * quantity);

  function adjust(delta: number) {
    setQuantity((q) => Math.max(step, Math.round((q + delta) * 100) / 100));
  }

  function handleAdd() {
    const result = addItem(product, quantity, undefined, {
      modifiers: selectedOptionsFlat.map((o) => ({ id: o.id, name: o.name, priceCents: o.price_cents })),
      notes: notes.trim() || undefined,
    });
    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    toast.success(`${product.name} agregado al carrito`);
    router.push(`/store/${slug}`);
  }

  return (
    <div className="space-y-5">
      {sortedGroups.map((group) => (
        <div key={group.id}>
          <div className="mb-1.5 flex items-baseline justify-between gap-2">
            <p className="text-sm font-medium text-foreground">{group.name}</p>
            <span className="text-xs text-muted-foreground">
              {group.is_required ? "obligatorio" : "opcional"}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {(optionsByGroup.get(group.id) ?? []).map((option) => {
              const isSelected = (selections[group.id] ?? []).includes(option.id);
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => toggleOption(group, option.id)}
                  className={cn(
                    "rounded-lg border px-3 py-1.5 text-sm font-medium",
                    isSelected ? "border-brand bg-brand/10 text-brand" : "border-border text-foreground",
                  )}
                >
                  {option.name}
                  {option.price_cents > 0 && ` · +${formatCurrencyCents(option.price_cents)}`}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      <div>
        <p className="mb-1.5 text-sm font-medium text-foreground">Notas (opcional)</p>
        <Textarea
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Ej. sin cebolla..."
        />
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 rounded-full border border-border px-1">
          <button
            type="button"
            onClick={() => adjust(-step)}
            className="flex size-9 items-center justify-center text-muted-foreground"
          >
            <Minus className="size-4" />
          </button>
          <span className="min-w-12 text-center text-sm font-medium tabular-nums">
            {quantity} {UNIT_SHORT_LABELS[product.unit]}
          </span>
          <button
            type="button"
            onClick={() => adjust(step)}
            className="flex size-9 items-center justify-center text-muted-foreground"
          >
            <Plus className="size-4" />
          </button>
        </div>
        <Button size="lg" className="h-11 flex-1" disabled={isOut || !allValid} onClick={handleAdd}>
          {isOut ? "Agotado" : !allValid ? "Elige tus opciones" : `Agregar · ${formatCurrencyCents(totalCents)}`}
        </Button>
      </div>
    </div>
  );
}

"use client";

import * as React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatCurrencyCents } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Product, ProductVariant, VariantAttribute } from "@/types/database";

export function VariantPickerDialog({
  product,
  variants,
  attributesByVariant,
  onOpenChange,
  onSelect,
}: {
  product: Product;
  variants: ProductVariant[];
  attributesByVariant: Map<string, VariantAttribute[]>;
  onOpenChange: (open: boolean) => void;
  onSelect: (variant: ProductVariant) => void;
}) {
  const attributeNames = React.useMemo(() => {
    const names = new Set<string>();
    for (const attrs of attributesByVariant.values()) {
      for (const a of attrs) names.add(a.attribute_name);
    }
    return [...names];
  }, [attributesByVariant]);

  const optionsByAttribute = React.useMemo(() => {
    const map = new Map<string, string[]>();
    for (const name of attributeNames) {
      const values = new Set<string>();
      for (const variant of variants) {
        for (const a of attributesByVariant.get(variant.id) ?? []) {
          if (a.attribute_name === name) values.add(a.attribute_value);
        }
      }
      map.set(name, [...values]);
    }
    return map;
  }, [attributeNames, variants, attributesByVariant]);

  const [selected, setSelected] = React.useState<Record<string, string>>({});

  const matchedVariant = React.useMemo(() => {
    if (attributeNames.some((name) => !selected[name])) return null;
    return (
      variants.find((v) => {
        const attrs = attributesByVariant.get(v.id) ?? [];
        return attributeNames.every((name) => attrs.some((a) => a.attribute_name === name && a.attribute_value === selected[name]));
      }) ?? null
    );
  }, [attributeNames, selected, variants, attributesByVariant]);

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{product.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {attributeNames.map((name) => (
            <div key={name}>
              <p className="mb-1.5 text-xs font-medium text-muted-foreground">{name}</p>
              <div className="flex flex-wrap gap-2">
                {(optionsByAttribute.get(name) ?? []).map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setSelected((s) => ({ ...s, [name]: value }))}
                    className={cn(
                      "rounded-lg border px-3 py-1.5 text-sm font-medium",
                      selected[name] === value ? "border-brand bg-brand/10 text-brand" : "border-border text-foreground",
                    )}
                  >
                    {value}
                  </button>
                ))}
              </div>
            </div>
          ))}

          <button
            type="button"
            disabled={!matchedVariant || matchedVariant.stock <= 0}
            onClick={() => matchedVariant && onSelect(matchedVariant)}
            className="flex h-11 w-full items-center justify-center rounded-lg bg-primary text-sm font-medium text-primary-foreground disabled:opacity-40"
          >
            {!matchedVariant
              ? "Elige una opción"
              : matchedVariant.stock <= 0
                ? "Sin stock"
                : `Agregar · ${formatCurrencyCents(matchedVariant.price_cents)}`}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

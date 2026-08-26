"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useCart } from "@/components/store/cart-context";
import { ModifierPicker } from "@/components/store/modifier-picker";
import { formatCurrencyCents } from "@/lib/format";
import { variantLabel } from "@/lib/variants";
import { cn } from "@/lib/utils";
import type {
  PublicModifierGroup,
  PublicModifierOption,
  PublicProduct,
  PublicVariant,
  PublicVariantAttribute,
} from "@/types/database";

export function ProductDetailActions({
  slug,
  product,
  variants = [],
  variantAttributes = [],
  modifierGroups = [],
  modifierOptions = [],
}: {
  slug: string;
  product: PublicProduct;
  variants?: PublicVariant[];
  variantAttributes?: PublicVariantAttribute[];
  modifierGroups?: PublicModifierGroup[];
  modifierOptions?: PublicModifierOption[];
}) {
  if (product.has_variants) {
    return (
      <VariantPicker
        slug={slug}
        product={product}
        variants={variants}
        variantAttributes={variantAttributes}
      />
    );
  }
  return (
    <ModifierPicker
      slug={slug}
      product={product}
      modifierGroups={modifierGroups}
      modifierOptions={modifierOptions}
    />
  );
}

function VariantPicker({
  slug,
  product,
  variants,
  variantAttributes,
}: {
  slug: string;
  product: PublicProduct;
  variants: PublicVariant[];
  variantAttributes: PublicVariantAttribute[];
}) {
  const router = useRouter();
  const { addItem } = useCart();

  const attributesByVariant = React.useMemo(() => {
    const map = new Map<string, PublicVariantAttribute[]>();
    for (const a of variantAttributes) {
      const list = map.get(a.variant_id) ?? [];
      list.push(a);
      map.set(a.variant_id, list);
    }
    return map;
  }, [variantAttributes]);

  const attributeNames = React.useMemo(
    () => [...new Set(variantAttributes.map((a) => a.attribute_name))],
    [variantAttributes],
  );
  const optionsByAttribute = React.useMemo(() => {
    const map = new Map<string, string[]>();
    for (const name of attributeNames) {
      map.set(name, [...new Set(variantAttributes.filter((a) => a.attribute_name === name).map((a) => a.attribute_value))]);
    }
    return map;
  }, [attributeNames, variantAttributes]);

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

  const isOut = matchedVariant ? matchedVariant.stock <= 0 : false;

  function handleAdd() {
    if (!matchedVariant) return;
    const attrs = attributesByVariant.get(matchedVariant.id) ?? [];
    const result = addItem(product, 1, {
      id: matchedVariant.id,
      label: variantLabel(attrs),
      priceCents: matchedVariant.price_cents,
      stock: matchedVariant.stock,
      imageUrl: matchedVariant.image_url,
    });
    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    toast.success(`${product.name} agregado al carrito`);
    router.push(`/store/${slug}`);
  }

  return (
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

      <Button size="lg" className="h-11 w-full" disabled={!matchedVariant || isOut} onClick={handleAdd}>
        {!matchedVariant
          ? "Elige una opción"
          : isOut
            ? "Agotado"
            : `Agregar al carrito · ${formatCurrencyCents(matchedVariant.price_cents)}`}
      </Button>
    </div>
  );
}

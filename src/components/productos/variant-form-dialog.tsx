"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  createVariantAction,
  updateVariantAction,
  type VariantAttributeInput,
  type VariantInput,
} from "@/app/(app)/productos/variant-actions";
import { COMMON_ATTRIBUTE_NAMES, SUGGESTED_ATTRIBUTE_VALUES, generateVariantSku } from "@/lib/variants";
import type { ProductVariant, VariantAttribute } from "@/types/database";

const EMPTY_ATTR: VariantAttributeInput = { name: "Talla", value: "" };

export function VariantFormDialog({
  productId,
  productName,
  variant,
  attributes,
}: {
  productId: string;
  productName: string;
  variant?: ProductVariant;
  attributes?: VariantAttribute[];
}) {
  const router = useRouter();
  const isEdit = Boolean(variant);
  const [open, setOpen] = React.useState(false);
  const [values, setValues] = React.useState<VariantInput>(
    variant
      ? {
          sku: variant.sku ?? "",
          price: (variant.price_cents / 100).toString(),
          cost: (variant.cost_cents / 100).toString(),
          stock: variant.stock.toString(),
          attributes: (attributes ?? []).map((a) => ({ name: a.attribute_name, value: a.attribute_value })),
        }
      : { sku: "", price: "", cost: "", stock: "", attributes: [{ ...EMPTY_ATTR }, { name: "Color", value: "" }] },
  );
  const [saving, setSaving] = React.useState(false);
  const skuTouchedRef = React.useRef(Boolean(variant?.sku));

  function patchAttr(index: number, patch: Partial<VariantAttributeInput>) {
    setValues((v) => {
      const attributes = v.attributes.map((a, i) => (i === index ? { ...a, ...patch } : a));
      return {
        ...v,
        attributes,
        sku: skuTouchedRef.current ? v.sku : generateVariantSku(productName, attributes),
      };
    });
  }

  function handleSkuChange(sku: string) {
    skuTouchedRef.current = true;
    setValues((v) => ({ ...v, sku }));
  }

  function addAttr() {
    setValues((v) => ({ ...v, attributes: [...v.attributes, { name: "", value: "" }] }));
  }

  function removeAttr(index: number) {
    setValues((v) => ({ ...v, attributes: v.attributes.filter((_, i) => i !== index) }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const result = isEdit
      ? await updateVariantAction(variant!.id, productId, values)
      : await createVariantAction(productId, values);
    setSaving(false);

    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    toast.success(isEdit ? "Variante actualizada." : "Variante creada.");
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {isEdit ? (
          <Button variant="ghost" size="icon-sm">
            <Pencil />
          </Button>
        ) : (
          <Button size="sm">
            <Plus /> Nueva variante
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{isEdit ? "Editar variante" : "Nueva variante"}</DialogTitle>
            <DialogDescription>Ej. Talla M, Color Negro. Cada variante tiene su propio stock.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Atributos</Label>
              {values.attributes.map((attr, i) => {
                const suggestedValues = SUGGESTED_ATTRIBUTE_VALUES[attr.name];
                const valueListId = suggestedValues ? `attribute-values-${attr.name}` : undefined;
                return (
                  <div key={i} className="flex items-center gap-2">
                    <Input
                      list="attribute-names"
                      value={attr.name}
                      onChange={(e) => patchAttr(i, { name: e.target.value })}
                      placeholder="Talla"
                      className="w-32"
                    />
                    <Input
                      list={valueListId}
                      value={attr.value}
                      onChange={(e) => patchAttr(i, { value: e.target.value })}
                      placeholder="M"
                    />
                    <button
                      type="button"
                      onClick={() => removeAttr(i)}
                      className="shrink-0 text-muted-foreground hover:text-destructive"
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                );
              })}
              <datalist id="attribute-names">
                {COMMON_ATTRIBUTE_NAMES.map((n) => (
                  <option key={n} value={n} />
                ))}
              </datalist>
              {Object.entries(SUGGESTED_ATTRIBUTE_VALUES).map(([name, suggestions]) => (
                <datalist key={name} id={`attribute-values-${name}`}>
                  {suggestions.map((s) => (
                    <option key={s} value={s} />
                  ))}
                </datalist>
              ))}
              <Button type="button" variant="ghost" size="sm" onClick={addAttr}>
                <Plus /> Agregar atributo
              </Button>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="variantPrice">Precio</Label>
                <Input
                  id="variantPrice"
                  inputMode="decimal"
                  value={values.price}
                  onChange={(e) => setValues((v) => ({ ...v, price: e.target.value }))}
                  placeholder="0"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="variantCost">Costo</Label>
                <Input
                  id="variantCost"
                  inputMode="decimal"
                  value={values.cost}
                  onChange={(e) => setValues((v) => ({ ...v, cost: e.target.value }))}
                  placeholder="0"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="variantStock">Stock</Label>
                <Input
                  id="variantStock"
                  inputMode="decimal"
                  value={values.stock}
                  onChange={(e) => setValues((v) => ({ ...v, stock: e.target.value }))}
                  placeholder="0"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="variantSku">SKU (opcional)</Label>
              <Input
                id="variantSku"
                value={values.sku}
                onChange={(e) => handleSkuChange(e.target.value)}
                placeholder="Se genera solo desde los atributos"
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Guardando..." : isEdit ? "Guardar cambios" : "Crear variante"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

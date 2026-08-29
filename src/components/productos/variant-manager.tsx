import { Boxes } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/catalog/status-badge";
import { ToggleStatusButton } from "@/components/catalog/toggle-status-button";
import { VariantFormDialog } from "@/components/productos/variant-form-dialog";
import { setVariantStatusAction } from "@/app/(app)/productos/variant-actions";
import { variantLabel } from "@/lib/variants";
import { formatCurrencyCents } from "@/lib/format";
import { formatQuantity } from "@/lib/inventory";
import type { ProductVariant, VariantAttribute } from "@/types/database";

export function VariantManager({
  productId,
  productName,
  variants,
  attributesByVariant,
}: {
  productId: string;
  productName: string;
  variants: ProductVariant[];
  attributesByVariant: Map<string, VariantAttribute[]>;
}) {
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold text-foreground">Variantes</p>
        <VariantFormDialog productId={productId} productName={productName} />
      </div>

      {variants.length === 0 ? (
        <EmptyState
          icon={Boxes}
          title="Sin variantes todavía"
          description="Crea variantes por talla, color u otro atributo. Cada una con su propio stock."
        />
      ) : (
        <div className="divide-y divide-border rounded-xl border border-border bg-card">
          {variants.map((variant) => {
            const attrs = attributesByVariant.get(variant.id) ?? [];
            return (
              <div key={variant.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1 basis-40">
                  <p className="text-sm font-medium text-foreground">{variantLabel(attrs)}</p>
                  <p className="text-xs text-muted-foreground">
                    {variant.sku && `${variant.sku} · `}
                    {formatCurrencyCents(variant.price_cents)} · {formatQuantity(variant.stock)} en stock
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <StatusBadge status={variant.status} />
                  <VariantFormDialog
                    productId={productId}
                    productName={productName}
                    variant={variant}
                    attributes={attrs}
                  />
                  <ToggleStatusButton
                    status={variant.status}
                    entityLabel="Variante"
                    onToggle={setVariantStatusAction.bind(null, variant.id, productId)}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

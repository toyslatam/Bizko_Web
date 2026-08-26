import { Layers } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { AddComboItemDialog } from "@/components/productos/add-combo-item-dialog";
import { ComboItemRemoveButton } from "@/components/productos/combo-item-remove-button";
import { removeComboItemAction } from "@/app/(app)/productos/modifier-actions";
import { UNIT_LABELS } from "@/lib/catalog";
import { formatQuantity } from "@/lib/inventory";
import type { ComboItem, Product } from "@/types/database";

export function ComboItemsManager({
  comboProductId,
  items,
  componentsById,
  availableProducts,
}: {
  comboProductId: string;
  items: ComboItem[];
  componentsById: Map<string, Pick<Product, "name" | "unit">>;
  availableProducts: Product[];
}) {
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold text-foreground">Incluye</p>
        <AddComboItemDialog comboProductId={comboProductId} availableProducts={availableProducts} />
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={Layers}
          title="Este combo aún no tiene productos"
          description="Agrega los productos que incluye, ej. 1 Hamburguesa + 1 Papas + 1 Bebida."
        />
      ) : (
        <div className="divide-y divide-border rounded-xl border border-border bg-card">
          {items.map((item) => {
            const component = componentsById.get(item.component_product_id);
            return (
              <div key={item.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <p className="text-sm text-foreground">
                  {formatQuantity(item.quantity)} {component ? UNIT_LABELS[component.unit] : ""} ·{" "}
                  <span className="font-medium">{component?.name ?? "Producto eliminado"}</span>
                </p>
                <ComboItemRemoveButton onRemove={removeComboItemAction.bind(null, item.id, comboProductId)} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

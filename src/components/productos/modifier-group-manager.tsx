import { Sliders } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { ModifierGroupFormDialog } from "@/components/productos/modifier-group-form-dialog";
import { ModifierGroupDeleteButton } from "@/components/productos/modifier-group-delete-button";
import { deleteModifierGroupAction } from "@/app/(app)/productos/modifier-actions";
import { formatCurrencyCents } from "@/lib/format";
import type { ModifierGroup, ModifierOption } from "@/types/database";

type ModifierGroupWithOptions = ModifierGroup & { modifier_options: ModifierOption[] };

export function ModifierGroupManager({
  productId,
  groups,
}: {
  productId: string;
  groups: ModifierGroupWithOptions[];
}) {
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold text-foreground">Modificadores</p>
        <ModifierGroupFormDialog productId={productId} />
      </div>

      {groups.length === 0 ? (
        <EmptyState
          icon={Sliders}
          title="Sin modificadores todavía"
          description="Crea grupos como salsas, adicionales o tamaño para que tus clientes personalicen el producto."
        />
      ) : (
        <div className="divide-y divide-border rounded-xl border border-border bg-card">
          {groups.map((group) => {
            const options = (group.modifier_options ?? []).slice().sort((a, b) => a.sort_order - b.sort_order);
            return (
              <div key={group.id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium text-foreground">{group.name}</p>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                        {group.selection_type === "single" ? "Una opción" : "Varias opciones"}
                      </span>
                      {group.is_required && (
                        <span className="rounded-full bg-brand/10 px-2 py-0.5 text-xs text-brand">Obligatorio</span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {options.map((o) => `${o.name} (${formatCurrencyCents(o.price_cents)})`).join(" · ") ||
                        "Sin opciones"}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <ModifierGroupFormDialog productId={productId} group={group} options={options} />
                    <ModifierGroupDeleteButton onDelete={deleteModifierGroupAction.bind(null, group.id, productId)} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

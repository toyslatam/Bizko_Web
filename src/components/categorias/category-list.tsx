"use client";

import { Tags } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/catalog/status-badge";
import { ToggleStatusButton } from "@/components/catalog/toggle-status-button";
import { CategoryFormDialog } from "@/components/categorias/category-form-dialog";
import { setCategoryStatusAction, type CategoryKind } from "@/app/(app)/categorias/actions";
import type { ExpenseCategory, ProductCategory, ServiceCategory } from "@/types/database";

export function CategoryList({
  kind,
  categories,
}: {
  kind: CategoryKind;
  categories: (ProductCategory | ServiceCategory | ExpenseCategory)[];
}) {
  if (categories.length === 0) {
    return (
      <EmptyState
        icon={Tags}
        title="Sin categorías todavía"
        description="Crea categorías para organizar tu catálogo."
        action={<CategoryFormDialog kind={kind} />}
      />
    );
  }

  return (
    <div className="divide-y divide-border rounded-xl border border-border bg-card">
      {categories.map((category) => (
        <div key={category.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
          <div className="min-w-0 flex-1 basis-40">
            <p className="truncate text-sm font-medium text-foreground">{category.name}</p>
            {category.description && (
              <p className="truncate text-xs text-muted-foreground">{category.description}</p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <StatusBadge status={category.status} />
            <CategoryFormDialog kind={kind} category={category} />
            <ToggleStatusButton
              status={category.status}
              entityLabel="Categoría"
              onToggle={(next) => setCategoryStatusAction(kind, category.id, next)}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

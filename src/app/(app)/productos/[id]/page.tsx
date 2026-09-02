import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, History, Package } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/lib/auth/session";
import { StatusBadge } from "@/components/catalog/status-badge";
import { ToggleStatusButton } from "@/components/catalog/toggle-status-button";
import { StockBadge } from "@/components/inventario/stock-badge";
import { MovementDialog } from "@/components/inventario/movement-dialog";
import { MovementList, type MovementRow } from "@/components/inventario/movement-list";
import { ProductFormSheet } from "@/components/productos/product-form-sheet";
import { VariantManager } from "@/components/productos/variant-manager";
import { ModifierGroupManager } from "@/components/productos/modifier-group-manager";
import { ComboItemsManager } from "@/components/productos/combo-items-manager";
import { ProductGalleryManager } from "@/components/productos/product-gallery-manager";
import { setProductStatusAction } from "@/app/(app)/productos/actions";
import { UNIT_LABELS } from "@/lib/catalog";
import { formatCurrencyCents } from "@/lib/format";
import { formatQuantity } from "@/lib/inventory";
import { groupAttributesByVariant } from "@/lib/variants";
import { can } from "@/lib/permissions";
import { EmptyState } from "@/components/ui/empty-state";
import type {
  ComboItem,
  ModifierGroup,
  ModifierOption,
  Product,
  ProductCategory,
  ProductImage,
  ProductVariant,
  VariantAttribute,
} from "@/types/database";

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSessionContext();
  if (!session) redirect("/login");
  if (!session.activeCompany) redirect("/onboarding");

  const { id } = await params;
  const supabase = await createClient();
  const [{ data: productData }, { data: categoriesData }, { data: movementsData }, { data: galleryData }] =
    await Promise.all([
      supabase.from("products").select("*").eq("id", id).maybeSingle(),
      supabase
        .from("product_categories")
        .select("*")
        .eq("company_id", session.activeCompany.id)
        .eq("status", "active")
        .order("name"),
      supabase
        .from("inventory_movements")
        .select("*, product:products(name,unit), user:profiles(first_name,last_name,email)")
        .eq("product_id", id)
        .order("created_at", { ascending: false })
        .limit(10),
      supabase.from("product_images").select("*").eq("product_id", id).order("sort_order"),
    ]);

  const product = productData as Product | null;
  if (!product) notFound();
  const categories = (categoriesData as ProductCategory[]) ?? [];
  const category = categories.find((c) => c.id === product.category_id);
  const margin = product.price_cents - product.cost_cents;
  const movements = (movementsData ?? []) as unknown as MovementRow[];
  const galleryImages = (galleryData as ProductImage[]) ?? [];
  const canEditInventory = can(session.activeMembership?.role ?? "employee", "inventario.editar");

  let variants: ProductVariant[] = [];
  let attributesByVariant = new Map<string, VariantAttribute[]>();
  if (product.has_variants) {
    const [{ data: variantsData }, { data: attrsData }] = await Promise.all([
      supabase.from("product_variants").select("*").eq("product_id", id).order("created_at"),
      supabase
        .from("variant_attributes")
        .select("*, product_variants!inner(product_id)")
        .eq("product_variants.product_id", id),
    ]);
    variants = (variantsData as ProductVariant[]) ?? [];
    attributesByVariant = groupAttributesByVariant((attrsData as VariantAttribute[]) ?? []);
  }

  let modifierGroups: (ModifierGroup & { modifier_options: ModifierOption[] })[] = [];
  if (!product.is_combo && !product.is_ingredient) {
    const { data: groupsData } = await supabase
      .from("modifier_groups")
      .select("*, modifier_options(*)")
      .eq("product_id", id)
      .order("sort_order");
    modifierGroups = (groupsData as (ModifierGroup & { modifier_options: ModifierOption[] })[]) ?? [];
  }

  let comboItems: ComboItem[] = [];
  const comboComponentsById = new Map<string, Pick<Product, "name" | "unit">>();
  let comboAvailableProducts: Product[] = [];
  if (product.is_combo) {
    const { data: comboItemsData } = await supabase
      .from("combo_items")
      .select("*")
      .eq("combo_product_id", id)
      .order("sort_order");
    comboItems = (comboItemsData as ComboItem[]) ?? [];

    const componentIds = comboItems.map((item) => item.component_product_id);
    if (componentIds.length > 0) {
      const { data: componentsData } = await supabase
        .from("products")
        .select("id, name, unit")
        .in("id", componentIds);
      for (const component of (componentsData as { id: string; name: string; unit: Product["unit"] }[]) ?? []) {
        comboComponentsById.set(component.id, { name: component.name, unit: component.unit });
      }
    }

    const { data: availableProductsData } = await supabase
      .from("products")
      .select("*")
      .eq("company_id", session.activeCompany.id)
      .eq("status", "active")
      .eq("is_combo", false)
      .neq("id", id)
      .order("name");
    comboAvailableProducts = (availableProductsData as Product[]) ?? [];
  }

  return (
    <div className="max-w-2xl">
      <Link
        href="/productos"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Productos
      </Link>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-muted">
            {product.image_url ? (
              <Image src={product.image_url} alt="" width={56} height={56} className="size-full object-cover" />
            ) : (
              <Package className="size-6 text-muted-foreground" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-heading text-xl font-semibold text-foreground">{product.name}</h1>
              <StatusBadge status={product.status} />
            </div>
            {category && <p className="text-sm text-muted-foreground">{category.name}</p>}
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <ProductFormSheet companyId={session.activeCompany.id} categories={categories} product={product} />
          <ToggleStatusButton
            status={product.status}
            entityLabel="Producto"
            onToggle={setProductStatusAction.bind(null, product.id)}
          />
        </div>
      </div>

      {!product.has_variants && (
        <div className="mt-6 grid grid-cols-3 gap-3">
          <Metric label="Precio de venta" value={formatCurrencyCents(product.price_cents)} />
          <Metric label="Costo" value={formatCurrencyCents(product.cost_cents)} />
          <Metric label="Margen" value={formatCurrencyCents(margin)} />
        </div>
      )}

      <div className="mt-4 grid gap-3 rounded-xl border border-border bg-card p-4 sm:grid-cols-2">
        <Field label="Unidad" value={UNIT_LABELS[product.unit]} />
        <Field label="SKU" value={product.sku} />
      </div>

      {product.description && (
        <div className="mt-4 rounded-xl border border-border bg-muted/40 p-4 text-sm text-foreground">
          <p className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Descripción
          </p>
          {product.description}
        </div>
      )}

      <div className="mt-6">
        <ProductGalleryManager
          productId={product.id}
          companyId={session.activeCompany.id}
          images={galleryImages}
        />
      </div>

      {product.has_variants ? (
        <div className="mt-6">
          <VariantManager
            productId={product.id}
            productName={product.name}
            variants={variants}
            attributesByVariant={attributesByVariant}
          />
        </div>
      ) : (
        <div className="mt-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-heading text-base font-semibold text-foreground">Inventario</h2>
            {product.track_inventory && canEditInventory && (
              <div className="flex gap-2">
                <MovementDialog mode="in" products={[product]} />
                <MovementDialog mode="adjustment" products={[product]} />
              </div>
            )}
          </div>

          {product.track_inventory ? (
            <>
              <div className="grid grid-cols-3 gap-3">
                <Metric label="Existencia actual" value={`${formatQuantity(product.current_stock)} ${UNIT_LABELS[product.unit]}`} />
                <Metric label="Stock mínimo" value={formatQuantity(product.minimum_stock)} />
                <div className="flex flex-col items-start justify-center rounded-xl border border-border bg-card p-4">
                  <p className="text-xs text-muted-foreground">Estado</p>
                  <div className="mt-1.5">
                    <StockBadge product={product} />
                  </div>
                </div>
              </div>

              <div className="mt-4">
                <p className="mb-2 text-sm font-medium text-foreground">Historial de inventario</p>
                {movements.length > 0 ? (
                  <MovementList movements={movements} />
                ) : (
                  <EmptyState
                    icon={History}
                    title="Sin movimientos todavía"
                    description="Las entradas, salidas y ajustes de este producto aparecerán aquí."
                  />
                )}
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Este producto no tiene control de inventario activado. Actívalo desde &quot;Editar&quot;
              si quieres controlar su existencia.
            </p>
          )}
        </div>
      )}

      {product.is_combo ? (
        <div className="mt-6">
          <ComboItemsManager
            comboProductId={product.id}
            items={comboItems}
            componentsById={comboComponentsById}
            availableProducts={comboAvailableProducts}
          />
        </div>
      ) : !product.is_ingredient ? (
        <div className="mt-6">
          <ModifierGroupManager productId={product.id} groups={modifierGroups} />
        </div>
      ) : null}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-heading text-lg font-semibold text-foreground">{value}</p>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm text-foreground">{value || "—"}</p>
    </div>
  );
}

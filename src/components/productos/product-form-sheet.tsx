"use client";

import * as React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PackagePlus, Pencil, ImagePlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { formatQuantity } from "@/lib/inventory";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  createProductAction,
  updateProductAction,
  type ProductInput,
} from "@/app/(app)/productos/actions";
import { uploadCompanyFile } from "@/lib/storage";
import { UNIT_LABELS, generateSkuFromName } from "@/lib/catalog";
import type { Product, ProductCategory, ProductUnit } from "@/types/database";

const UNITS = Object.keys(UNIT_LABELS) as ProductUnit[];

const EMPTY: ProductInput = {
  name: "",
  description: "",
  sku: "",
  categoryId: null,
  price: "",
  cost: "",
  unit: "unidad",
  imageUrl: null,
  trackInventory: false,
  minimumStock: "",
  initialStock: "",
  isPublished: false,
  hasVariants: false,
  isFeatured: false,
  isIngredient: false,
  isCombo: false,
};

export function ProductFormSheet({
  companyId,
  categories,
  product,
}: {
  companyId: string;
  categories: ProductCategory[];
  product?: Product;
}) {
  const router = useRouter();
  const isEdit = Boolean(product);
  const [open, setOpen] = React.useState(false);
  const [values, setValues] = React.useState<ProductInput>(
    product
      ? {
          name: product.name,
          description: product.description ?? "",
          sku: product.sku ?? "",
          categoryId: product.category_id,
          price: (product.price_cents / 100).toString(),
          cost: (product.cost_cents / 100).toString(),
          unit: product.unit,
          imageUrl: product.image_url,
          trackInventory: product.track_inventory,
          minimumStock: product.minimum_stock.toString(),
          initialStock: "",
          isPublished: product.is_published,
          hasVariants: product.has_variants,
          isFeatured: product.is_featured,
          isIngredient: product.is_ingredient,
          isCombo: product.is_combo,
        }
      : EMPTY,
  );
  const [errors, setErrors] = React.useState<Partial<Record<"name" | "price", string>>>({});
  const [saving, setSaving] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const skuTouchedRef = React.useRef(Boolean(product?.sku));

  function patch<K extends keyof ProductInput>(key: K, value: ProductInput[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  function handleNameChange(name: string) {
    setValues((v) => ({
      ...v,
      name,
      sku: skuTouchedRef.current ? v.sku : generateSkuFromName(name),
    }));
  }

  function handleSkuChange(sku: string) {
    skuTouchedRef.current = true;
    patch("sku", sku);
  }

  async function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadCompanyFile("product-images", companyId, file);
      patch("imageUrl", url);
    } catch {
      toast.error("No pudimos subir la imagen.");
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErrors({});

    const result = isEdit
      ? await updateProductAction(product!.id, values)
      : await createProductAction(values);
    setSaving(false);

    if ("error" in result) {
      setErrors(result.fieldErrors ?? {});
      toast.error(result.error);
      return;
    }

    toast.success(isEdit ? "Producto actualizado." : "Producto creado correctamente.");
    setOpen(false);
    if (!isEdit) setValues(EMPTY);
    router.refresh();
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {isEdit ? (
          <Button variant="outline" size="sm">
            <Pencil /> Editar
          </Button>
        ) : (
          <Button>
            <PackagePlus /> Nuevo producto
          </Button>
        )}
      </SheetTrigger>
      <SheetContent className="overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{isEdit ? "Editar producto" : "Nuevo producto"}</SheetTitle>
          <SheetDescription>
            {isEdit ? "Actualiza la información del producto." : "Agrega un producto a tu catálogo."}
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col gap-5 overflow-y-auto px-4">
          <div className="space-y-3">
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Información principal
            </p>

            <div className="flex items-center gap-3">
              <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-muted">
                {values.imageUrl ? (
                  <Image src={values.imageUrl} alt="" width={64} height={64} className="size-full object-cover" />
                ) : (
                  <ImagePlus className="size-5 text-muted-foreground" />
                )}
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="productImage" className="cursor-pointer text-sm font-medium text-brand">
                  {uploading ? "Subiendo..." : values.imageUrl ? "Cambiar imagen" : "Subir imagen"}
                </Label>
                <input
                  id="productImage"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={uploading}
                  onChange={handleImageChange}
                />
                {values.imageUrl && (
                  <button
                    type="button"
                    onClick={() => patch("imageUrl", null)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <X className="size-4" />
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="productName">Nombre</Label>
              <Input
                id="productName"
                autoFocus
                value={values.name}
                onChange={(e) => handleNameChange(e.target.value)}
                aria-invalid={Boolean(errors.name)}
              />
              {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
              <div>
                <p className="text-sm font-medium text-foreground">Producto con variantes</p>
                <p className="text-xs text-muted-foreground">
                  Ej. talla y color, cada una con su propio precio y stock.
                </p>
              </div>
              <Switch
                checked={values.hasVariants}
                onCheckedChange={(checked) => patch("hasVariants", checked)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              {!values.hasVariants && (
                <div className="space-y-1.5">
                  <Label htmlFor="productPrice">Precio de venta</Label>
                  <Input
                    id="productPrice"
                    inputMode="decimal"
                    value={values.price}
                    onChange={(e) => patch("price", e.target.value)}
                    placeholder="0"
                    aria-invalid={Boolean(errors.price)}
                  />
                  {errors.price && <p className="text-xs text-destructive">{errors.price}</p>}
                </div>
              )}
              <div className="space-y-1.5">
                <Label>Unidad</Label>
                <Select value={values.unit} onValueChange={(v) => patch("unit", v as ProductUnit)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {UNITS.map((u) => (
                      <SelectItem key={u} value={u}>
                        {UNIT_LABELS[u]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {values.hasVariants && (
              <p className="text-xs text-muted-foreground">
                {isEdit
                  ? "El precio y el stock se manejan por variante — ver abajo en el detalle del producto."
                  : "Después de crear el producto, agrega sus variantes desde el detalle."}
              </p>
            )}
          </div>

          <div className="space-y-3">
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Información adicional
            </p>
            <div className="space-y-1.5">
              <Label>Categoría</Label>
              <Select
                value={values.categoryId ?? "none"}
                onValueChange={(v) => patch("categoryId", v === "none" ? null : v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Sin categoría" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin categoría</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="productCost">Costo (opcional)</Label>
                <Input
                  id="productCost"
                  inputMode="decimal"
                  value={values.cost}
                  onChange={(e) => patch("cost", e.target.value)}
                  placeholder="0"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="productSku">SKU (opcional)</Label>
                <Input
                  id="productSku"
                  value={values.sku}
                  onChange={(e) => handleSkuChange(e.target.value)}
                  placeholder="Se genera solo desde el nombre"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="productDescription">Descripción</Label>
              <Textarea
                id="productDescription"
                rows={3}
                value={values.description}
                onChange={(e) => patch("description", e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Catálogo público
            </p>
            <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
              <div>
                <p className="text-sm font-medium text-foreground">Publicar en catálogo</p>
                <p className="text-xs text-muted-foreground">
                  Aparece en tu tienda pública para que tus clientes lo pidan.
                </p>
              </div>
              <Switch
                checked={values.isPublished}
                onCheckedChange={(checked) => patch("isPublished", checked)}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
              <div>
                <p className="text-sm font-medium text-foreground">Producto destacado</p>
                <p className="text-xs text-muted-foreground">
                  Aparece primero y en la sección de destacados de tu catálogo.
                </p>
              </div>
              <Switch
                checked={values.isFeatured}
                onCheckedChange={(checked) => patch("isFeatured", checked)}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
              <div>
                <p className="text-sm font-medium text-foreground">Es un insumo</p>
                <p className="text-xs text-muted-foreground">
                  Materia prima (ej. carne, pan, queso) — no se vende directo, solo se controla en Inventario.
                </p>
              </div>
              <Switch
                checked={values.isIngredient}
                onCheckedChange={(checked) => {
                  patch("isIngredient", checked);
                  if (checked) patch("isPublished", false);
                }}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
              <div>
                <p className="text-sm font-medium text-foreground">Es un combo</p>
                <p className="text-xs text-muted-foreground">
                  Incluye varios productos (ej. Combo Hamburguesa = hamburguesa + papas + bebida).
                </p>
              </div>
              <Switch
                checked={values.isCombo}
                onCheckedChange={(checked) => patch("isCombo", checked)}
              />
            </div>
            {values.isCombo && (
              <p className="text-xs text-muted-foreground">
                {isEdit
                  ? "Los productos incluidos se configuran desde el detalle del producto."
                  : "Después de crear el producto, agrega lo que incluye desde el detalle."}
              </p>
            )}
          </div>

          {!values.hasVariants && (
          <div className="space-y-3">
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Inventario
            </p>
            <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
              <div>
                <p className="text-sm font-medium text-foreground">Controlar inventario</p>
                <p className="text-xs text-muted-foreground">
                  Descuenta stock automáticamente en cada venta.
                </p>
              </div>
              <Switch
                checked={values.trackInventory}
                onCheckedChange={(checked) => patch("trackInventory", checked)}
              />
            </div>

            {values.trackInventory && (
              <div className="grid grid-cols-2 gap-3">
                {isEdit ? (
                  <div className="space-y-1.5">
                    <Label>Existencia actual</Label>
                    <p className="flex h-9 items-center text-sm text-muted-foreground">
                      {formatQuantity(product!.current_stock)} — se cambia desde Inventario
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <Label htmlFor="productInitialStock">Stock inicial</Label>
                    <Input
                      id="productInitialStock"
                      inputMode="decimal"
                      value={values.initialStock}
                      onChange={(e) => patch("initialStock", e.target.value)}
                      placeholder="0"
                    />
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label htmlFor="productMinStock">Stock mínimo</Label>
                  <Input
                    id="productMinStock"
                    inputMode="decimal"
                    value={values.minimumStock}
                    onChange={(e) => patch("minimumStock", e.target.value)}
                    placeholder="0"
                  />
                </div>
              </div>
            )}
          </div>
          )}
        </form>

        <SheetFooter>
          <Button type="submit" onClick={handleSubmit} disabled={saving || uploading}>
            {saving ? "Guardando..." : isEdit ? "Guardar cambios" : "Crear producto"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

"use client";

import * as React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Package,
  Wrench,
  Minus,
  Plus,
  Trash2,
  ShoppingCart,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { SearchInput } from "@/components/ui/search-input";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { CustomerCombobox } from "@/components/ventas/customer-combobox";
import { VariantPickerDialog } from "@/components/ventas/variant-picker-dialog";
import { createSaleAction, type CartItemInput } from "@/app/(app)/ventas/actions";
import { formatCurrencyCents } from "@/lib/format";
import { UNIT_SHORT_LABELS } from "@/lib/catalog";
import { PAYMENT_METHOD_LABELS } from "@/lib/sales";
import { groupAttributesByVariant } from "@/lib/variants";
import type { Customer, PaymentMethod, Product, ProductVariant, Service, VariantAttribute } from "@/types/database";

interface CartLine extends CartItemInput {
  key: string;
  imageUrl: string | null;
  unitLabel: string | null;
}

type CatalogEntry =
  | { kind: "product"; item: Product }
  | { kind: "service"; item: Service };

export function SaleBuilder({
  products,
  services,
  customers,
  variants,
  variantAttributes,
  canEditPrice,
}: {
  companyId: string;
  products: Product[];
  services: Service[];
  customers: Customer[];
  variants: ProductVariant[];
  variantAttributes: VariantAttribute[];
  canEditPrice: boolean;
}) {
  const router = useRouter();
  const [search, setSearch] = React.useState("");
  const [typeFilter, setTypeFilter] = React.useState<"all" | "product" | "service">("all");
  const [cart, setCart] = React.useState<CartLine[]>([]);
  const [customerId, setCustomerId] = React.useState("");
  const [paymentMethod, setPaymentMethod] = React.useState<PaymentMethod>("cash");
  const [discount, setDiscount] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [mobileCartOpen, setMobileCartOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [variantPickerProduct, setVariantPickerProduct] = React.useState<Product | null>(null);

  const attributesByVariant = React.useMemo(() => groupAttributesByVariant(variantAttributes), [variantAttributes]);
  const variantsByProduct = React.useMemo(() => {
    const map = new Map<string, ProductVariant[]>();
    for (const v of variants) {
      const list = map.get(v.product_id) ?? [];
      list.push(v);
      map.set(v.product_id, list);
    }
    return map;
  }, [variants]);

  const catalog: CatalogEntry[] = React.useMemo(() => {
    const items: CatalogEntry[] = [
      ...products.map((item) => ({ kind: "product" as const, item })),
      ...services.map((item) => ({ kind: "service" as const, item })),
    ];
    const q = search.trim().toLowerCase();
    return items
      .filter((entry) => typeFilter === "all" || entry.kind === typeFilter)
      .filter((entry) => {
        if (!q) return true;
        const name = entry.item.name.toLowerCase();
        const sku = entry.kind === "product" ? (entry.item.sku ?? "").toLowerCase() : "";
        return name.includes(q) || sku.includes(q);
      });
  }, [products, services, search, typeFilter]);

  function addToCart(entry: CatalogEntry) {
    if (entry.kind === "product" && entry.item.has_variants) {
      setVariantPickerProduct(entry.item);
      return;
    }
    const refId = entry.item.id;
    setCart((prev) => {
      const existingIndex = prev.findIndex(
        (line) =>
          (entry.kind === "product" && line.productId === refId && !line.variantId) ||
          (entry.kind === "service" && line.serviceId === refId),
      );
      if (existingIndex >= 0) {
        const next = [...prev];
        next[existingIndex] = { ...next[existingIndex], quantity: next[existingIndex].quantity + 1 };
        return next;
      }
      const line: CartLine =
        entry.kind === "product"
          ? {
              key: `product-${refId}`,
              itemType: "product",
              productId: refId,
              serviceId: null,
              variantId: null,
              name: entry.item.name,
              quantity: 1,
              unitPriceCents: entry.item.price_cents,
              discountCents: 0,
              imageUrl: entry.item.image_url,
              unitLabel: UNIT_SHORT_LABELS[entry.item.unit],
            }
          : {
              key: `service-${refId}`,
              itemType: "service",
              productId: null,
              serviceId: refId,
              variantId: null,
              name: entry.item.name,
              quantity: 1,
              unitPriceCents: entry.item.price_cents,
              discountCents: 0,
              imageUrl: entry.item.image_url,
              unitLabel: entry.item.duration_minutes ? `${entry.item.duration_minutes} min` : null,
            };
      return [...prev, line];
    });
  }

  function addVariantToCart(product: Product, variant: ProductVariant) {
    const attrs = attributesByVariant.get(variant.id) ?? [];
    const label = attrs.map((a) => a.attribute_value).join(" / ");
    setCart((prev) => {
      const key = `product-${product.id}-${variant.id}`;
      const existingIndex = prev.findIndex((line) => line.key === key);
      if (existingIndex >= 0) {
        const next = [...prev];
        next[existingIndex] = { ...next[existingIndex], quantity: next[existingIndex].quantity + 1 };
        return next;
      }
      const line: CartLine = {
        key,
        itemType: "product",
        productId: product.id,
        serviceId: null,
        variantId: variant.id,
        name: label ? `${product.name} (${label})` : product.name,
        quantity: 1,
        unitPriceCents: variant.price_cents,
        discountCents: 0,
        imageUrl: variant.image_url ?? product.image_url,
        unitLabel: UNIT_SHORT_LABELS[product.unit],
      };
      return [...prev, line];
    });
    setVariantPickerProduct(null);
  }

  function updateLine(key: string, patch: Partial<CartLine>) {
    setCart((prev) => prev.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  }

  function removeLine(key: string) {
    setCart((prev) => prev.filter((line) => line.key !== key));
  }

  const subtotalCents = cart.reduce(
    (sum, l) => sum + Math.round(l.unitPriceCents * l.quantity) - l.discountCents,
    0,
  );
  const discountCents = Math.max(0, Math.round(Number(discount.replace(",", ".") || 0) * 100));
  const totalCents = Math.max(subtotalCents - discountCents, 0);
  const itemCount = cart.reduce((sum, l) => sum + l.quantity, 0);

  async function handleConfirm() {
    if (cart.length === 0) {
      toast.error("Agrega al menos un producto o servicio.");
      return;
    }
    setSaving(true);
    const result = await createSaleAction({
      customerId: customerId || null,
      paymentMethod,
      discountCents,
      notes,
      items: cart.map((line) => ({
        itemType: line.itemType,
        productId: line.productId,
        serviceId: line.serviceId,
        variantId: line.variantId,
        name: line.name,
        quantity: line.quantity,
        unitPriceCents: line.unitPriceCents,
        discountCents: line.discountCents,
      })),
    });
    setSaving(false);

    if ("error" in result) {
      toast.error("No pudimos registrar la venta", { description: result.error });
      return;
    }

    toast.success("Venta completada", { description: `# ${result.saleNumber}` });
    router.push(`/ventas/${result.id}?created=1`);
  }

  const cartPanel = (
    <CartPanel
      cart={cart}
      customers={customers}
      customerId={customerId}
      onCustomerChange={setCustomerId}
      paymentMethod={paymentMethod}
      onPaymentMethodChange={setPaymentMethod}
      discount={discount}
      onDiscountChange={setDiscount}
      notes={notes}
      onNotesChange={setNotes}
      canEditPrice={canEditPrice}
      onUpdateLine={updateLine}
      onRemoveLine={removeLine}
      subtotalCents={subtotalCents}
      totalCents={totalCents}
      saving={saving}
      onConfirm={handleConfirm}
    />
  );

  return (
    <div className="grid gap-4 pb-20 md:grid-cols-[1fr_360px] md:pb-0">
      <div className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <SearchInput
            placeholder="Buscar por nombre o SKU..."
            onChange={(e) => setSearch(e.target.value)}
            className="sm:max-w-xs"
          />
          <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as typeof typeFilter)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todo</SelectItem>
              <SelectItem value="product">Productos</SelectItem>
              <SelectItem value="service">Servicios</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {catalog.length === 0 ? (
          <EmptyState
            icon={ShoppingCart}
            title="No encontramos nada"
            description="Prueba con otro nombre o revisa tu catálogo."
          />
        ) : (
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
            {catalog.map((entry) => (
              <button
                key={`${entry.kind}-${entry.item.id}`}
                type="button"
                onClick={() => addToCart(entry)}
                className="flex flex-col items-start gap-2 rounded-xl border border-border bg-card p-3 text-left transition-colors hover:border-brand/50 hover:bg-brand/5"
              >
                <div className="flex w-full items-start justify-between gap-1">
                  <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted">
                    {entry.item.image_url ? (
                      <Image
                        src={entry.item.image_url}
                        alt=""
                        width={40}
                        height={40}
                        className="size-full object-cover"
                      />
                    ) : entry.kind === "product" ? (
                      <Package className="size-4 text-muted-foreground" />
                    ) : (
                      <Wrench className="size-4 text-muted-foreground" />
                    )}
                  </div>
                  <Badge variant={entry.kind === "product" ? "secondary" : "outline"} className="text-[10px]">
                    {entry.kind === "product" ? "Producto" : "Servicio"}
                  </Badge>
                </div>
                <p className="line-clamp-2 text-sm font-medium text-foreground">{entry.item.name}</p>
                <p className="text-sm font-semibold text-brand">
                  {formatCurrencyCents(entry.item.price_cents)}
                </p>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="hidden md:block">
        <div className="sticky top-[4.5rem]">{cartPanel}</div>
      </div>

      <div className="fixed inset-x-0 bottom-16 z-30 border-t border-border bg-card px-4 py-3 md:hidden">
        <button
          type="button"
          onClick={() => setMobileCartOpen(true)}
          className="flex w-full items-center justify-between gap-3 rounded-xl bg-primary px-4 py-3 text-primary-foreground"
        >
          <span className="flex items-center gap-2 text-sm font-medium">
            <ShoppingCart className="size-4" />
            {itemCount > 0 ? `${itemCount} ítem${itemCount === 1 ? "" : "s"}` : "Carrito vacío"}
          </span>
          <span className="text-base font-semibold">{formatCurrencyCents(totalCents)}</span>
        </button>
      </div>

      <Sheet open={mobileCartOpen} onOpenChange={setMobileCartOpen}>
        <SheetContent side="bottom" className="h-[90dvh] overflow-y-auto rounded-t-2xl">
          <SheetHeader>
            <SheetTitle>Tu venta</SheetTitle>
          </SheetHeader>
          <div className="px-4 pb-6">{cartPanel}</div>
        </SheetContent>
      </Sheet>

      {variantPickerProduct && (
        <VariantPickerDialog
          product={variantPickerProduct}
          variants={variantsByProduct.get(variantPickerProduct.id) ?? []}
          attributesByVariant={attributesByVariant}
          onOpenChange={(open) => !open && setVariantPickerProduct(null)}
          onSelect={(variant) => addVariantToCart(variantPickerProduct, variant)}
        />
      )}
    </div>
  );
}

function CartPanel({
  cart,
  customers,
  customerId,
  onCustomerChange,
  paymentMethod,
  onPaymentMethodChange,
  discount,
  onDiscountChange,
  notes,
  onNotesChange,
  canEditPrice,
  onUpdateLine,
  onRemoveLine,
  subtotalCents,
  totalCents,
  saving,
  onConfirm,
}: {
  cart: CartLine[];
  customers: Customer[];
  customerId: string;
  onCustomerChange: (v: string) => void;
  paymentMethod: PaymentMethod;
  onPaymentMethodChange: (v: PaymentMethod) => void;
  discount: string;
  onDiscountChange: (v: string) => void;
  notes: string;
  onNotesChange: (v: string) => void;
  canEditPrice: boolean;
  onUpdateLine: (key: string, patch: Partial<CartLine>) => void;
  onRemoveLine: (key: string) => void;
  subtotalCents: number;
  totalCents: number;
  saving: boolean;
  onConfirm: () => void;
}) {
  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4">
      <div className="space-y-1.5">
        <Label>Cliente</Label>
        <CustomerCombobox customers={customers} value={customerId} onChange={onCustomerChange} />
      </div>

      <div className="max-h-64 space-y-2 overflow-y-auto">
        {cart.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Toca un producto o servicio para agregarlo.
          </p>
        ) : (
          cart.map((line) => (
            <div key={line.key} className="flex items-start gap-2 rounded-lg border border-border p-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{line.name}</p>
                <div className="mt-1 flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => onUpdateLine(line.key, { quantity: Math.max(1, line.quantity - 1) })}
                    className="flex size-6 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-muted"
                  >
                    <Minus className="size-3" />
                  </button>
                  <span className="w-6 text-center text-sm tabular-nums">{line.quantity}</span>
                  <button
                    type="button"
                    onClick={() => onUpdateLine(line.key, { quantity: line.quantity + 1 })}
                    className="flex size-6 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-muted"
                  >
                    <Plus className="size-3" />
                  </button>
                  {line.unitLabel && (
                    <span className="text-xs text-muted-foreground">{line.unitLabel}</span>
                  )}
                </div>
                {canEditPrice && (
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <span className="text-xs text-muted-foreground">Precio</span>
                    <Input
                      inputMode="decimal"
                      value={(line.unitPriceCents / 100).toString()}
                      onChange={(e) => {
                        const n = Number(e.target.value.replace(",", "."));
                        if (!Number.isNaN(n) && n >= 0) {
                          onUpdateLine(line.key, { unitPriceCents: Math.round(n * 100) });
                        }
                      }}
                      className="h-6 w-20 px-1.5 text-xs"
                    />
                  </div>
                )}
              </div>
              <div className="flex flex-col items-end gap-1.5">
                <span className="text-sm font-medium text-foreground">
                  {formatCurrencyCents(Math.round(line.unitPriceCents * line.quantity) - line.discountCents)}
                </span>
                <button
                  type="button"
                  onClick={() => onRemoveLine(line.key)}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="space-y-2 border-t border-border pt-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Subtotal</span>
          <span className="text-foreground">{formatCurrencyCents(subtotalCents)}</span>
        </div>
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="text-muted-foreground">Descuento</span>
          <Input
            inputMode="decimal"
            value={discount}
            onChange={(e) => onDiscountChange(e.target.value)}
            placeholder="0"
            className="h-7 w-24 text-right"
          />
        </div>
        <div className="flex items-center justify-between font-heading text-base font-semibold text-foreground">
          <span>Total</span>
          <span>{formatCurrencyCents(totalCents)}</span>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Método de pago</Label>
        <Select value={paymentMethod} onValueChange={(v) => onPaymentMethodChange(v as PaymentMethod)}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="saleNotes">Notas (opcional)</Label>
        <Textarea
          id="saleNotes"
          rows={2}
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
        />
      </div>

      <Button size="lg" className="h-12 text-base" disabled={saving || cart.length === 0} onClick={onConfirm}>
        {saving ? "Confirmando..." : `Confirmar venta · ${formatCurrencyCents(totalCents)}`}
      </Button>
    </div>
  );
}

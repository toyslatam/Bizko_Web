"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { toast } from "sonner";
import { ChevronRight, Package, Plus, Star } from "lucide-react";
import { useCart } from "@/components/store/cart-context";
import { ProductQuickView } from "@/components/store/product-quick-view";
import { formatCurrencyCents } from "@/lib/format";
import { UNIT_SHORT_LABELS } from "@/lib/catalog";
import type { PublicProduct } from "@/types/database";

export function ProductCard({ slug, product }: { slug: string; product: PublicProduct }) {
  const { addItem } = useCart();
  const [quickViewOpen, setQuickViewOpen] = React.useState(false);
  const isOut = product.track_inventory && product.current_stock <= 0;
  const defaultQty = product.unit === "kg" || product.unit === "litro" || product.unit === "libra" ? 0.5 : 1;

  function handleAdd(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (product.has_variants) {
      setQuickViewOpen(true);
      return;
    }
    const result = addItem(product, defaultQty);
    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    toast.success(`${product.name} agregado`);
  }

  function handleOpen(e: React.MouseEvent) {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;
    e.preventDefault();
    setQuickViewOpen(true);
  }

  return (
    <>
      <Link
        href={`/store/${slug}/producto/${product.id}`}
        onClick={handleOpen}
        className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-all duration-200 lg:hover:-translate-y-0.5 lg:hover:shadow-lg"
      >
        <div className="relative aspect-square w-full overflow-hidden bg-muted">
          {product.image_url ? (
            <Image
              src={product.image_url}
              alt=""
              fill
              className="object-cover"
              sizes="(min-width: 1280px) 22vw, (min-width: 1024px) 30vw, 45vw"
            />
          ) : (
            <div className="flex size-full items-center justify-center">
              <Package className="size-8 text-muted-foreground" />
            </div>
          )}
          {isOut && (
            <span className="absolute top-2 left-2 rounded-full bg-foreground/80 px-2 py-0.5 text-[11px] font-medium text-white">
              Agotado
            </span>
          )}
          {product.is_featured && !isOut && (
            <span className="absolute top-2 left-2 flex items-center gap-1 rounded-full bg-brand px-2 py-0.5 text-[11px] font-medium text-white">
              <Star className="size-3 fill-current" /> Destacado
            </span>
          )}
        </div>
        <div className="flex flex-1 flex-col gap-1 p-3">
          <p className="line-clamp-2 text-sm font-medium text-foreground">{product.name}</p>
          <div className="mt-auto flex items-center justify-between pt-1">
            <span className="text-sm font-semibold text-foreground">
              {formatCurrencyCents(product.price_cents)}
              <span className="text-xs font-normal text-muted-foreground"> /{UNIT_SHORT_LABELS[product.unit]}</span>
            </span>
            <button
              type="button"
              onClick={handleAdd}
              disabled={isOut}
              aria-label={product.has_variants ? `Ver opciones de ${product.name}` : `Agregar ${product.name}`}
              className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform disabled:opacity-40 lg:group-hover:scale-105"
            >
              {product.has_variants ? <ChevronRight className="size-4" /> : <Plus className="size-4" />}
            </button>
          </div>
        </div>
      </Link>

      <ProductQuickView
        slug={slug}
        product={product}
        open={quickViewOpen}
        onOpenChange={setQuickViewOpen}
      />
    </>
  );
}

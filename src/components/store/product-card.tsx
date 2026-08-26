"use client";

import Image from "next/image";
import Link from "next/link";
import { toast } from "sonner";
import { ChevronRight, Package, Plus, Star } from "lucide-react";
import { useCart } from "@/components/store/cart-context";
import { formatCurrencyCents } from "@/lib/format";
import { UNIT_SHORT_LABELS } from "@/lib/catalog";
import type { PublicProduct } from "@/types/database";

export function ProductCard({ slug, product }: { slug: string; product: PublicProduct }) {
  const { addItem } = useCart();
  const isOut = product.track_inventory && product.current_stock <= 0;
  const defaultQty = product.unit === "kg" || product.unit === "litro" || product.unit === "libra" ? 0.5 : 1;

  function handleAdd(e: React.MouseEvent) {
    if (product.has_variants) return; // navega al detalle a elegir variante
    e.preventDefault();
    const result = addItem(product, defaultQty);
    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    toast.success(`${product.name} agregado`);
  }

  return (
    <Link
      href={`/store/${slug}/producto/${product.id}`}
      className="flex flex-col overflow-hidden rounded-xl border border-border bg-card"
    >
      <div className="relative aspect-square w-full bg-muted">
        {product.image_url ? (
          <Image src={product.image_url} alt="" fill className="object-cover" sizes="200px" />
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
            className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-40"
          >
            {product.has_variants ? <ChevronRight className="size-4" /> : <Plus className="size-4" />}
          </button>
        </div>
      </div>
    </Link>
  );
}

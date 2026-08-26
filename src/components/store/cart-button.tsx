"use client";

import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { useCart } from "@/components/store/cart-context";
import { formatCurrencyCents } from "@/lib/format";

export function CartButton({ slug }: { slug: string }) {
  const { itemCount, subtotalCents } = useCart();

  return (
    <Link
      href={`/store/${slug}/carrito`}
      className="flex items-center gap-2 rounded-full py-1.5 pr-1 pl-2.5 text-white/90 transition-colors hover:bg-white/10 hover:text-white"
      aria-label="Ver carrito"
    >
      {itemCount > 0 && (
        <span className="hidden text-sm font-semibold sm:inline">{formatCurrencyCents(subtotalCents)}</span>
      )}
      <span className="relative flex size-8 shrink-0 items-center justify-center rounded-full bg-white/10">
        <ShoppingCart className="size-4" />
        {itemCount > 0 && (
          <span className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
            {itemCount > 9 ? "9+" : itemCount}
          </span>
        )}
      </span>
    </Link>
  );
}

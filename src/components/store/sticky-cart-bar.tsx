"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShoppingCart } from "lucide-react";
import { useCart } from "@/components/store/cart-context";
import { formatCurrencyCents } from "@/lib/format";

export function StickyCartBar({ slug }: { slug: string }) {
  const pathname = usePathname();
  const { itemCount, subtotalCents } = useCart();

  const hidden = pathname.endsWith("/carrito") || pathname.endsWith("/checkout");
  if (hidden || itemCount === 0) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card px-4 py-3 shadow-[0_-2px_8px_rgba(0,0,0,0.06)] md:hidden">
      <Link
        href={`/store/${slug}/carrito`}
        className="flex items-center justify-between gap-3 rounded-full bg-primary px-4 py-2.5 text-primary-foreground"
      >
        <span className="flex items-center gap-2 text-sm font-semibold">
          <ShoppingCart className="size-4" />
          {itemCount} {itemCount === 1 ? "producto" : "productos"}
        </span>
        <span className="flex items-center gap-2 text-sm font-semibold">
          {formatCurrencyCents(subtotalCents)}
          <span className="rounded-full bg-white/20 px-2.5 py-1 text-xs">Ver carrito</span>
        </span>
      </Link>
    </div>
  );
}

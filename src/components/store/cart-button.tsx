"use client";

import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { useCart } from "@/components/store/cart-context";

export function CartButton({ slug }: { slug: string }) {
  const { itemCount } = useCart();

  return (
    <Link
      href={`/store/${slug}/carrito`}
      className="relative flex size-9 items-center justify-center rounded-full text-white/90 hover:text-white"
      aria-label="Ver carrito"
    >
      <ShoppingCart className="size-5" />
      {itemCount > 0 && (
        <span className="absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
          {itemCount > 9 ? "9+" : itemCount}
        </span>
      )}
    </Link>
  );
}

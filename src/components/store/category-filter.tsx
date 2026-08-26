"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PublicCategory } from "@/types/database";

export function CategoryFilter({ categories }: { categories: PublicCategory[] }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const active = searchParams.get("categoria");
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const [overflow, setOverflow] = React.useState({ left: false, right: false });

  const updateOverflow = React.useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const hasOverflow = el.scrollWidth > el.clientWidth + 1;
    setOverflow({
      left: hasOverflow && el.scrollLeft > 4,
      right: hasOverflow && el.scrollLeft + el.clientWidth < el.scrollWidth - 4,
    });
  }, []);

  React.useEffect(() => {
    updateOverflow();
    window.addEventListener("resize", updateOverflow);
    return () => window.removeEventListener("resize", updateOverflow);
  }, [updateOverflow, categories.length]);

  function buildHref(categoryId: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (categoryId) params.set("categoria", categoryId);
    else params.delete("categoria");
    const qs = params.toString();
    return `${pathname}${qs ? `?${qs}` : ""}`;
  }

  function scrollByAmount(amount: number) {
    scrollRef.current?.scrollBy({ left: amount, behavior: "smooth" });
  }

  return (
    <div className="relative">
      {overflow.left && (
        <button
          type="button"
          onClick={() => scrollByAmount(-160)}
          aria-label="Desplazar categorías a la izquierda"
          className="absolute top-1/2 left-0 z-10 hidden -translate-y-1/2 items-center justify-center rounded-full bg-card p-1 shadow-md ring-1 ring-border lg:flex"
        >
          <ChevronLeft className="size-4" />
        </button>
      )}
      <div
        ref={scrollRef}
        onScroll={updateOverflow}
        className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] lg:mx-0 lg:justify-end lg:px-0"
      >
        <Link
          href={buildHref(null)}
          className={cn(
            "shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium whitespace-nowrap transition-colors",
            !active
              ? "border-brand bg-brand text-white"
              : "border-border bg-card text-foreground hover:bg-muted",
          )}
        >
          Todos
        </Link>
        {categories.map((c) => (
          <Link
            key={c.id}
            href={buildHref(c.id)}
            className={cn(
              "shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium whitespace-nowrap transition-colors",
              active === c.id
                ? "border-brand bg-brand text-white"
                : "border-border bg-card text-foreground hover:bg-muted",
            )}
          >
            {c.name}
          </Link>
        ))}
      </div>
      {overflow.right && (
        <button
          type="button"
          onClick={() => scrollByAmount(160)}
          aria-label="Desplazar categorías a la derecha"
          className="absolute top-1/2 right-0 z-10 hidden -translate-y-1/2 items-center justify-center rounded-full bg-card p-1 shadow-md ring-1 ring-border lg:flex"
        >
          <ChevronRight className="size-4" />
        </button>
      )}
    </div>
  );
}

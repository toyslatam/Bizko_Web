"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { PublicCategory } from "@/types/database";

export function StoreNav({ slug, categories }: { slug: string; categories: PublicCategory[] }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isHome = pathname === `/store/${slug}`;
  const activeCategory = isHome ? searchParams.get("categoria") : null;
  const isAvailableOnly = isHome && searchParams.get("disponible") === "1";

  function buildHref(overrides: Record<string, string | null>) {
    const params = new URLSearchParams(isHome ? searchParams.toString() : "");
    for (const [key, value] of Object.entries(overrides)) {
      if (value === null) params.delete(key);
      else params.set(key, value);
    }
    const qs = params.toString();
    return `/store/${slug}${qs ? `?${qs}` : ""}`;
  }

  const itemClass = (active: boolean) =>
    cn(
      "shrink-0 rounded-md px-2.5 py-1.5 font-medium whitespace-nowrap transition-colors",
      active ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted/60",
    );

  return (
    <nav className="border-b border-border bg-card">
      <div className="mx-auto flex max-w-[1600px] items-center gap-0.5 overflow-x-auto px-4 py-1.5 text-sm [scrollbar-width:none] lg:px-10">
        <Link href={`/store/${slug}`} className={itemClass(isHome && !activeCategory && !isAvailableOnly)}>
          Inicio
        </Link>
        <Link
          href={buildHref({ disponible: isAvailableOnly ? null : "1" })}
          className={itemClass(isAvailableOnly)}
        >
          Disponibles
        </Link>
        <span className="flex shrink-0 cursor-default items-center gap-1.5 rounded-md px-2.5 py-1.5 font-medium whitespace-nowrap text-muted-foreground/50">
          Descuentos
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-normal">Próximamente</span>
        </span>
        {categories.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger
              className={cn(
                "hidden shrink-0 items-center gap-1 outline-none lg:flex",
                itemClass(Boolean(activeCategory)),
              )}
            >
              Categorías
              <ChevronDown className="size-3.5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="max-h-72 min-w-40">
              {categories.map((c) => (
                <DropdownMenuItem key={c.id} asChild>
                  <Link href={buildHref({ categoria: c.id })}>{c.name}</Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </nav>
  );
}

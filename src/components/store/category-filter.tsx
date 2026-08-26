"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import type { PublicCategory } from "@/types/database";

export function CategoryFilter({ categories }: { categories: PublicCategory[] }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const active = searchParams.get("categoria");

  return (
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] lg:mx-0 lg:justify-end lg:px-0">
      <Link
        href={pathname}
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
          href={`${pathname}?categoria=${c.id}`}
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
  );
}

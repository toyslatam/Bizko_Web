"use client";

import * as React from "react";
import { Search } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export function SearchBar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [value, setValue] = React.useState(searchParams.get("buscar") ?? "");

  React.useEffect(() => {
    const timeout = setTimeout(() => {
      const current = searchParams.get("buscar") ?? "";
      if (value === current) return;
      const params = new URLSearchParams(searchParams.toString());
      if (value) params.set("buscar", value);
      else params.delete("buscar");
      router.push(`${pathname}${params.toString() ? `?${params.toString()}` : ""}`);
    }, 350);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Buscar productos..."
        className="w-full rounded-full border border-border bg-card py-2.5 pr-3 pl-9 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand/40"
      />
    </div>
  );
}

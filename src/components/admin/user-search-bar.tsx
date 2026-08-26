"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SearchInput } from "@/components/ui/search-input";

export function UserSearchBar({ placeholder }: { placeholder: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [search, setSearch] = React.useState(searchParams.get("q") ?? "");

  React.useEffect(() => {
    const timeout = setTimeout(() => {
      if (search !== (searchParams.get("q") ?? "")) {
        const params = new URLSearchParams(searchParams.toString());
        if (search) params.set("q", search);
        else params.delete("q");
        params.delete("page");
        router.push(`${pathname}?${params.toString()}`);
      }
    }, 350);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  return (
    <div className="sm:max-w-xs">
      <SearchInput
        placeholder={placeholder}
        defaultValue={search}
        onChange={(e) => setSearch(e.target.value)}
      />
    </div>
  );
}

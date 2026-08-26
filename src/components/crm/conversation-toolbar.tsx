"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FilterBar } from "@/components/ui/filter-bar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CHANNEL_TYPE_LABELS, CHANNEL_TYPES, CONVERSATION_STATUS_LABELS, CONVERSATION_STATUSES } from "@/lib/crm-channels";

/** Filtro por canal y estado de la bandeja, sincronizado con la URL. */
export function ConversationToolbar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function updateParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== "all") params.set(key, value);
    else params.delete(key);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <FilterBar>
      <Select
        value={searchParams.get("channel") ?? "all"}
        onValueChange={(v) => updateParam("channel", v)}
      >
        <SelectTrigger className="w-40">
          <SelectValue placeholder="Canal" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos los canales</SelectItem>
          {CHANNEL_TYPES.map((c) => (
            <SelectItem key={c} value={c}>
              {CHANNEL_TYPE_LABELS[c]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={searchParams.get("status") ?? "all"}
        onValueChange={(v) => updateParam("status", v)}
      >
        <SelectTrigger className="w-36">
          <SelectValue placeholder="Estado" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos los estados</SelectItem>
          {CONVERSATION_STATUSES.map((s) => (
            <SelectItem key={s} value={s}>
              {CONVERSATION_STATUS_LABELS[s]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FilterBar>
  );
}

"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Calendar } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PERIOD_PRESET_LABELS, type PeriodPreset } from "@/lib/date-range";

const PRESETS = Object.keys(PERIOD_PRESET_LABELS) as PeriodPreset[];

export function PeriodFilter() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const preset = (searchParams.get("period") as PeriodPreset) || "today";
  const [start, setStart] = React.useState(searchParams.get("start") ?? "");
  const [end, setEnd] = React.useState(searchParams.get("end") ?? "");

  function applyPreset(next: PeriodPreset) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("period", next);
    if (next !== "custom") {
      params.delete("start");
      params.delete("end");
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  function applyCustom() {
    if (!start || !end) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("period", "custom");
    params.set("start", start);
    params.set("end", end);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={preset} onValueChange={(v) => applyPreset(v as PeriodPreset)}>
        <SelectTrigger className="w-full sm:w-48">
          <Calendar className="size-4 text-muted-foreground" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {PRESETS.map((p) => (
            <SelectItem key={p} value={p}>
              {PERIOD_PRESET_LABELS[p]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {preset === "custom" && (
        <div className="flex flex-wrap items-center gap-2">
          <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="w-40" />
          <span className="text-sm text-muted-foreground">a</span>
          <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="w-40" />
          <button
            type="button"
            onClick={applyCustom}
            className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
          >
            Aplicar
          </button>
        </div>
      )}
    </div>
  );
}

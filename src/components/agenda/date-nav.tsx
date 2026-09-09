"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { shiftDate, shiftMonth, type AgendaView } from "@/lib/agenda-dates";

const VIEW_OPTIONS: { value: AgendaView; label: string }[] = [
  { value: "day", label: "Día" },
  { value: "week", label: "Semana" },
  { value: "month", label: "Mes" },
];

export function DateNav({ date, view }: { date: string; view: AgendaView }) {
  const router = useRouter();

  function goTo(nextDate: string, nextView: AgendaView = view) {
    router.push(`/agenda?date=${nextDate}&view=${nextView}`);
  }

  function shift(direction: 1 | -1) {
    if (view === "week") return goTo(shiftDate(date, direction * 7));
    if (view === "month") return goTo(shiftMonth(date, direction));
    return goTo(shiftDate(date, direction));
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1.5">
        <Button variant="outline" size="icon" onClick={() => shift(-1)}>
          <ChevronLeft />
        </Button>
        <Input
          type="date"
          value={date}
          onChange={(e) => e.target.value && goTo(e.target.value)}
          className="w-auto"
        />
        <Button variant="outline" size="icon" onClick={() => shift(1)}>
          <ChevronRight />
        </Button>
      </div>
      <Tabs value={view} onValueChange={(v) => goTo(date, v as AgendaView)}>
        <TabsList>
          {VIEW_OPTIONS.map((option) => (
            <TabsTrigger key={option.value} value={option.value}>
              {option.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </div>
  );
}

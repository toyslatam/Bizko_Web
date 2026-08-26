"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function shiftDate(date: string, days: number) {
  const [year, month, day] = date.split("-").map(Number);
  const d = new Date(Date.UTC(year, month - 1, day));
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function DateNav({ date }: { date: string }) {
  const router = useRouter();

  function goTo(next: string) {
    router.push(`/agenda?date=${next}`);
  }

  return (
    <div className="flex items-center gap-1.5">
      <Button variant="outline" size="icon" onClick={() => goTo(shiftDate(date, -1))}>
        <ChevronLeft />
      </Button>
      <Input
        type="date"
        value={date}
        onChange={(e) => e.target.value && goTo(e.target.value)}
        className="w-auto"
      />
      <Button variant="outline" size="icon" onClick={() => goTo(shiftDate(date, 1))}>
        <ChevronRight />
      </Button>
    </div>
  );
}

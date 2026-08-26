"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { formatCurrencyCents } from "@/lib/format";

export interface SalesByHourPoint {
  hour_of_day: number;
  total_cents: number;
  sales_count: number;
}

function formatHourLabel(hour: number) {
  return `${hour.toString().padStart(2, "0")}:00`;
}

export function SalesByHourChart({ data }: { data: SalesByHourPoint[] }) {
  const chartData = Array.from({ length: 24 }, (_, hour) => {
    const point = data.find((d) => d.hour_of_day === hour);
    return {
      hour,
      label: formatHourLabel(hour),
      total_cents: point?.total_cents ?? 0,
      sales_count: point?.sales_count ?? 0,
    };
  });

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ left: 0, right: 0, top: 8, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis
            dataKey="label"
            axisLine={false}
            tickLine={false}
            interval={2}
            tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
          />
          <Tooltip
            cursor={{ fill: "var(--muted)" }}
            contentStyle={{
              background: "var(--popover)",
              border: "1px solid var(--border)",
              borderRadius: "0.75rem",
              fontSize: 12,
            }}
            formatter={(value, name) =>
              name === "total_cents"
                ? [formatCurrencyCents(Number(value)), "Ventas"]
                : [value, name]
            }
            labelFormatter={(label) => `Hora: ${label}`}
          />
          <Bar dataKey="total_cents" fill="var(--brand)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

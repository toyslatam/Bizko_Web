"use client";

import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";
import { formatCurrencyCents } from "@/lib/format";
import { SALE_SOURCE_LABELS } from "@/lib/sales";
import type { SaleSource } from "@/types/database";

export interface SalesBySourcePoint {
  source: SaleSource;
  total_cents: number;
  sales_count: number;
}

const SOURCE_COLORS: Record<SaleSource, string> = {
  pos: "var(--chart-1)",
  menu: "var(--chart-2)",
  delivery: "var(--chart-3)",
  table: "var(--chart-4)",
  takeout: "var(--chart-5)",
  appointment: "var(--chart-1)",
};

export function SalesBySourceChart({ data }: { data: SalesBySourcePoint[] }) {
  const chartData = data.map((d) => ({
    ...d,
    label: SALE_SOURCE_LABELS[d.source],
  }));

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={chartData}
            dataKey="total_cents"
            nameKey="label"
            innerRadius="55%"
            outerRadius="85%"
            paddingAngle={2}
          >
            {chartData.map((d) => (
              <Cell key={d.source} fill={SOURCE_COLORS[d.source]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              background: "var(--popover)",
              border: "1px solid var(--border)",
              borderRadius: "0.75rem",
              fontSize: 12,
            }}
            formatter={(value) => [formatCurrencyCents(Number(value)), "Ventas"]}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

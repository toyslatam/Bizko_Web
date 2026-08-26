"use client";

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { formatCurrencyCents } from "@/lib/format";

export interface ExpensesByDayPoint {
  day: string;
  total_cents: number;
}

function formatDayLabel(day: string) {
  return new Date(`${day}T00:00:00`).toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "short",
  });
}

export function ExpensesByDayChart({ data }: { data: ExpensesByDayPoint[] }) {
  const chartData = data.map((d) => ({ ...d, label: formatDayLabel(d.day) }));

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ left: 0, right: 0, top: 8, bottom: 0 }}>
          <defs>
            <linearGradient id="expensesByDayFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--destructive)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="var(--destructive)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis
            dataKey="label"
            axisLine={false}
            tickLine={false}
            tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
          />
          <Tooltip
            cursor={{ stroke: "var(--destructive)", strokeWidth: 1 }}
            contentStyle={{
              background: "var(--popover)",
              border: "1px solid var(--border)",
              borderRadius: "0.75rem",
              fontSize: 12,
            }}
            formatter={(value) => [formatCurrencyCents(Number(value)), "Gastos"]}
          />
          <Area
            type="monotone"
            dataKey="total_cents"
            stroke="var(--destructive)"
            strokeWidth={2}
            fill="url(#expensesByDayFill)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

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

export interface WeekSalePoint {
  day: string;
  total: number;
}

export interface TopSoldItem {
  name: string;
  unitsSold: number;
}

export function PerformancePanel({
  weekSales,
  topItems,
}: {
  weekSales: WeekSalePoint[];
  topItems: TopSoldItem[];
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="rounded-xl border border-border bg-card p-4 lg:col-span-2">
        <p className="text-sm font-medium text-foreground">Ventas de los últimos 7 días</p>
        <div className="mt-2 h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={weekSales} margin={{ left: 0, right: 0, top: 8, bottom: 0 }}>
              <defs>
                <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--brand)" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="var(--brand)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="var(--border)" />
              <XAxis
                dataKey="day"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
              />
              <Tooltip
                cursor={{ stroke: "var(--brand)", strokeWidth: 1 }}
                contentStyle={{
                  background: "var(--popover)",
                  border: "1px solid var(--border)",
                  borderRadius: "0.75rem",
                  fontSize: 12,
                }}
                formatter={(value) => [formatCurrencyCents(Number(value)), "Ventas"]}
              />
              <Area
                type="monotone"
                dataKey="total"
                stroke="var(--brand)"
                strokeWidth={2}
                fill="url(#salesFill)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <p className="text-sm font-medium text-foreground">Más vendidos</p>
        {topItems.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Todavía no hay suficientes ventas para mostrar un ranking.
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {topItems.map((p, i) => (
              <li key={p.name} className="flex items-center gap-3">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                  {i + 1}
                </span>
                <span className="flex-1 truncate text-sm text-foreground">{p.name}</span>
                <span className="text-xs text-muted-foreground">{p.unitsSold} und.</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

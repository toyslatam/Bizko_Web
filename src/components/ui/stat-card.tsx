import * as React from "react";
import { cn } from "@/lib/utils";
import { type LucideIcon, TrendingDown, TrendingUp } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string;
  icon?: LucideIcon;
  deltaPct?: number;
  hint?: string;
  className?: string;
}

export function StatCard({
  label,
  value,
  icon: Icon,
  deltaPct,
  hint,
  className,
}: StatCardProps) {
  const isPositive = (deltaPct ?? 0) >= 0;

  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card p-4 shadow-sm",
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        {Icon && (
          <span className="flex size-8 items-center justify-center rounded-lg bg-brand/10 text-brand">
            <Icon className="size-4" />
          </span>
        )}
      </div>
      <p className="mt-2 font-heading text-2xl font-semibold text-foreground">
        {value}
      </p>
      {(deltaPct !== undefined || hint) && (
        <div className="mt-1 flex items-center gap-1 text-xs">
          {deltaPct !== undefined && (
            <span
              className={cn(
                "flex items-center gap-0.5 font-medium",
                isPositive ? "text-success" : "text-destructive",
              )}
            >
              {isPositive ? (
                <TrendingUp className="size-3.5" />
              ) : (
                <TrendingDown className="size-3.5" />
              )}
              {Math.abs(deltaPct)}%
            </span>
          )}
          {hint && <span className="text-muted-foreground">{hint}</span>}
        </div>
      )}
    </div>
  );
}

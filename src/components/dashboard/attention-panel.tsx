import Link from "next/link";
import { ChevronRight, AlertTriangle, CircleCheck } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";

export interface AttentionItem {
  id: string;
  title: string;
  description: string;
  href: string;
  tone: "warning" | "destructive";
}

export function AttentionPanel({ items }: { items: AttentionItem[] }) {
  if (items.length === 0) {
    return (
      <EmptyState
        icon={CircleCheck}
        title="Todo al día"
        description="No tienes pendientes por revisar en este momento."
      />
    );
  }

  return (
    <div className="divide-y divide-border rounded-xl border border-border bg-card">
      {items.map((item) => (
        <Link
          key={item.id}
          href={item.href}
          className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-muted/50"
        >
          <span
            className={cn(
              "flex size-8 shrink-0 items-center justify-center rounded-full",
              item.tone === "destructive"
                ? "bg-destructive/10 text-destructive"
                : "bg-warning/15 text-warning",
            )}
          >
            <AlertTriangle className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">{item.title}</p>
            <p className="truncate text-xs text-muted-foreground">{item.description}</p>
          </div>
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
        </Link>
      ))}
    </div>
  );
}

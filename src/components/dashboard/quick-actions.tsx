import Link from "next/link";
import { ShoppingCart, ClipboardPlus, PackagePlus, UserPlus } from "lucide-react";
import { demoQuickActions } from "@/lib/demo-data";

const ICONS = {
  sale: ShoppingCart,
  order: ClipboardPlus,
  product: PackagePlus,
  customer: UserPlus,
} as const;

export function QuickActions() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {demoQuickActions.map((action) => {
        const Icon = ICONS[action.icon];
        return (
          <Link
            key={action.href}
            href={action.href}
            className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card px-3 py-4 text-center transition-colors hover:bg-muted/60"
          >
            <span className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Icon className="size-5" />
            </span>
            <span className="text-xs font-medium text-foreground">{action.label}</span>
          </Link>
        );
      })}
    </div>
  );
}

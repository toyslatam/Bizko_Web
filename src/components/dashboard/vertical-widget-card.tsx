import Link from "next/link";
import type { LucideIcon } from "lucide-react";

interface Stat {
  label: string;
  value: string;
}

export function VerticalWidgetCard({
  icon: Icon,
  title,
  href,
  linkLabel,
  stats,
}: {
  icon: LucideIcon;
  title: string;
  href: string;
  linkLabel: string;
  stats: Stat[];
}) {
  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-heading text-base font-semibold text-foreground">{title}</h2>
        <Link href={href} className="text-sm font-medium text-brand hover:underline">
          {linkLabel}
        </Link>
      </div>
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-4">
        <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
          <Icon className="size-4 text-muted-foreground" />
        </span>
        {stats.map((s) => (
          <span key={s.label} className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{s.value}</span> {s.label}
          </span>
        ))}
      </div>
    </section>
  );
}

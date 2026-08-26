import type { LucideIcon } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";

interface ComingSoonPageProps {
  title: string;
  description: string;
  icon: LucideIcon;
  emptyTitle: string;
  emptyDescription: string;
  actionLabel: string;
}

/** Pantalla estándar para módulos del CORE aún no implementados. */
export function ComingSoonPage({
  title,
  description,
  icon,
  emptyTitle,
  emptyDescription,
  actionLabel,
}: ComingSoonPageProps) {
  return (
    <div>
      <PageHeader
        title={title}
        description={description}
        actions={<Button disabled>{actionLabel}</Button>}
      />
      <EmptyState icon={icon} title={emptyTitle} description={emptyDescription} />
    </div>
  );
}

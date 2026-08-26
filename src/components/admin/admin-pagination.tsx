import Link from "next/link";
import { Button } from "@/components/ui/button";

interface AdminPaginationProps {
  page: number;
  pageSize: number;
  totalCount: number;
  buildHref: (page: number) => string;
}

export function AdminPagination({ page, pageSize, totalCount, buildHref }: AdminPaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  if (totalPages <= 1) return null;

  const start = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalCount);

  return (
    <div className="flex flex-col items-center justify-between gap-3 pt-2 sm:flex-row">
      <p className="text-sm text-muted-foreground">
        {start}–{end} de {totalCount}
      </p>
      <div className="flex gap-2">
        {page <= 1 ? (
          <Button variant="outline" size="sm" disabled>
            Anterior
          </Button>
        ) : (
          <Button variant="outline" size="sm" asChild>
            <Link href={buildHref(page - 1)}>Anterior</Link>
          </Button>
        )}
        {page >= totalPages ? (
          <Button variant="outline" size="sm" disabled>
            Siguiente
          </Button>
        ) : (
          <Button variant="outline" size="sm" asChild>
            <Link href={buildHref(page + 1)}>Siguiente</Link>
          </Button>
        )}
      </div>
    </div>
  );
}

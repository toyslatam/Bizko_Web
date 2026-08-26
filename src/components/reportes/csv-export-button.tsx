"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toCsv, downloadCsv, type CsvColumn } from "@/lib/csv";

export function CsvExportButton<T>({
  filename,
  rows,
  columns,
}: {
  filename: string;
  rows: T[];
  columns: CsvColumn<T>[];
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={rows.length === 0}
      onClick={() => downloadCsv(filename, toCsv(rows, columns))}
    >
      <Download /> Exportar CSV
    </Button>
  );
}

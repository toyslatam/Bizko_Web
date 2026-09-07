import Link from "next/link";
import Image from "next/image";
import { Scissors } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { MobileList, MobileListItem } from "@/components/ui/mobile-list";
import { StatusBadge } from "@/components/catalog/status-badge";
import { summarizeWorkSchedule } from "@/lib/professionals";
import type { Professional } from "@/types/database";

function Thumb({ professional }: { professional: Professional }) {
  return (
    <div className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-muted">
      {professional.photo_url ? (
        <Image
          src={professional.photo_url}
          alt=""
          width={36}
          height={36}
          className="size-full object-cover"
        />
      ) : (
        <Scissors className="size-4 text-muted-foreground" />
      )}
    </div>
  );
}

export function ProfessionalList({ professionals }: { professionals: Professional[] }) {
  return (
    <>
      <div className="hidden overflow-hidden rounded-xl border border-border md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Profesional</TableHead>
              <TableHead>Especialidad</TableHead>
              <TableHead>Horario</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {professionals.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium text-foreground">
                  <Link href={`/profesionales/${p.id}`} className="flex items-center gap-2.5">
                    <Thumb professional={p} />
                    {p.name}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground">{p.specialty || "—"}</TableCell>
                <TableCell className="text-muted-foreground">
                  {summarizeWorkSchedule(p.work_days, p.work_start_time, p.work_end_time)}
                </TableCell>
                <TableCell>
                  <StatusBadge status={p.status} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <MobileList>
        {professionals.map((p) => (
          <MobileListItem
            key={p.id}
            href={`/profesionales/${p.id}`}
            title={p.name}
            subtitle={
              [p.specialty, summarizeWorkSchedule(p.work_days, p.work_start_time, p.work_end_time)]
                .filter(Boolean)
                .join(" · ")
            }
            leading={<Thumb professional={p} />}
            trailing={<StatusBadge status={p.status} />}
          />
        ))}
      </MobileList>
    </>
  );
}

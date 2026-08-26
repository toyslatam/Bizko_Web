import Link from "next/link";
import Image from "next/image";
import { Wrench } from "lucide-react";
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
import { formatCurrencyCents } from "@/lib/format";
import type { Service } from "@/types/database";

function Thumb({ service }: { service: Service }) {
  return (
    <div className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted">
      {service.image_url ? (
        <Image src={service.image_url} alt="" width={36} height={36} className="size-full object-cover" />
      ) : (
        <Wrench className="size-4 text-muted-foreground" />
      )}
    </div>
  );
}

function durationLabel(minutes: number | null) {
  return minutes ? `${minutes} min` : "—";
}

export function ServiceList({ services }: { services: Service[] }) {
  return (
    <>
      <div className="hidden overflow-hidden rounded-xl border border-border md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Servicio</TableHead>
              <TableHead>Precio</TableHead>
              <TableHead>Duración</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {services.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-medium text-foreground">
                  <Link href={`/servicios/${s.id}`} className="flex items-center gap-2.5">
                    <Thumb service={s} />
                    {s.name}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatCurrencyCents(s.price_cents)}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {durationLabel(s.duration_minutes)}
                </TableCell>
                <TableCell>
                  <StatusBadge status={s.status} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <MobileList>
        {services.map((s) => (
          <MobileListItem
            key={s.id}
            href={`/servicios/${s.id}`}
            title={s.name}
            subtitle={`${formatCurrencyCents(s.price_cents)} · ${durationLabel(s.duration_minutes)}`}
            leading={<Thumb service={s} />}
            trailing={<StatusBadge status={s.status} />}
          />
        ))}
      </MobileList>
    </>
  );
}

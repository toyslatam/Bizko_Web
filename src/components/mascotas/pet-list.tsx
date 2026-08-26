import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { MobileList, MobileListItem } from "@/components/ui/mobile-list";
import { customerFullName } from "@/lib/catalog";
import type { Customer, Pet } from "@/types/database";

export type PetWithCustomer = Pet & {
  customers: Pick<Customer, "first_name" | "last_name"> | null;
};

function speciesBreed(pet: Pet) {
  return [pet.species, pet.breed].filter(Boolean).join(" · ") || "—";
}

function ownerName(pet: PetWithCustomer) {
  return pet.customers ? customerFullName(pet.customers) : "—";
}

export function PetList({ pets }: { pets: PetWithCustomer[] }) {
  return (
    <>
      <div className="hidden overflow-hidden rounded-xl border border-border md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Especie / Raza</TableHead>
              <TableHead>Dueño</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pets.map((p) => (
              <TableRow key={p.id} className="cursor-pointer">
                <TableCell className="font-medium text-foreground">
                  <Link href={`/mascotas/${p.id}`} className="block">
                    {p.name}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground">{speciesBreed(p)}</TableCell>
                <TableCell className="text-muted-foreground">{ownerName(p)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <MobileList>
        {pets.map((p) => (
          <MobileListItem
            key={p.id}
            href={`/mascotas/${p.id}`}
            title={p.name}
            subtitle={speciesBreed(p)}
            leading={
              <Avatar className="size-9">
                <AvatarFallback className="bg-brand/15 text-xs font-semibold text-brand">
                  {p.name.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            }
            trailing={
              <span className="text-xs text-muted-foreground">{ownerName(p)}</span>
            }
          />
        ))}
      </MobileList>
    </>
  );
}

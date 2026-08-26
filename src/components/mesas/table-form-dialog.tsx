"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { createTableAction } from "@/app/(app)/mesas/actions";

export function TableFormDialog() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [capacity, setCapacity] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const parsedCapacity = capacity.trim() ? Number(capacity) : null;
    const result = await createTableAction({
      name,
      capacity: parsedCapacity !== null && !Number.isNaN(parsedCapacity) ? parsedCapacity : null,
    });
    setSaving(false);

    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    toast.success("Mesa creada.");
    setOpen(false);
    setName("");
    setCapacity("");
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus /> Nueva mesa
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Nueva mesa</DialogTitle>
            <DialogDescription>Se agregará a la vista de mesas de tu negocio.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
              <Label htmlFor="tableName">Nombre</Label>
              <Input
                id="tableName"
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Mesa 1"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tableCapacity">Capacidad</Label>
              <Input
                id="tableCapacity"
                type="number"
                min={1}
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
                placeholder="4"
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving || !name.trim()}>
              {saving ? "Guardando..." : "Crear mesa"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ListPlus } from "lucide-react";
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
import { createTaskAction, type CrmOwner } from "@/app/(app)/crm/leads/task-note-tag-actions";

export function CrmTaskFormDialog({ owner }: { owner: CrmOwner }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [title, setTitle] = React.useState("");
  const [dueAt, setDueAt] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    const result = await createTaskAction(owner, {
      title,
      dueAt: dueAt ? new Date(dueAt).toISOString() : null,
    });
    setSaving(false);

    if ("error" in result) {
      setError(result.error);
      toast.error(result.error);
      return;
    }

    toast.success("Tarea creada.");
    setOpen(false);
    setTitle("");
    setDueAt("");
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <ListPlus /> Nueva tarea
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nueva tarea</DialogTitle>
          <DialogDescription>Agrega un pendiente para dar seguimiento.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="taskTitle">Título</Label>
            <Input
              id="taskTitle"
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej. Llamar para confirmar cotización"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="taskDueAt">Fecha límite (opcional)</Label>
            <Input
              id="taskDueAt"
              type="datetime-local"
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
            />
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </form>
        <DialogFooter>
          <Button type="submit" onClick={handleSubmit} disabled={saving || !title.trim()}>
            {saving ? "Guardando..." : "Crear tarea"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Settings2, ArrowUp, ArrowDown, Trash2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  createStageAction,
  updateStageAction,
  deleteStageAction,
  moveStageAction,
} from "@/app/(app)/crm/leads/pipeline-actions";
import type { CrmPipelineStage } from "@/types/database";

export function PipelineSettingsDialog({ stages }: { stages: CrmPipelineStage[] }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [newStageName, setNewStageName] = React.useState("");
  const [creating, setCreating] = React.useState(false);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const sorted = [...stages].sort((a, b) => a.sort_order - b.sort_order);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newStageName.trim()) return;
    setCreating(true);
    const result = await createStageAction(newStageName);
    setCreating(false);

    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    setNewStageName("");
    router.refresh();
  }

  async function handleRename(stage: CrmPipelineStage, name: string) {
    if (!name.trim() || name === stage.name) return;
    const result = await updateStageAction(stage.id, { name, isWon: stage.is_won, isLost: stage.is_lost });
    if ("error" in result) toast.error(result.error);
    router.refresh();
  }

  async function handleToggle(stage: CrmPipelineStage, field: "isWon" | "isLost", value: boolean) {
    setBusyId(stage.id);
    const result = await updateStageAction(stage.id, {
      name: stage.name,
      isWon: field === "isWon" ? value : stage.is_won,
      isLost: field === "isLost" ? value : stage.is_lost,
    });
    setBusyId(null);
    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    router.refresh();
  }

  async function handleMove(id: string, direction: "up" | "down") {
    setBusyId(id);
    const result = await moveStageAction(id, direction);
    setBusyId(null);
    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    router.refresh();
  }

  async function handleDelete() {
    if (!deletingId) return;
    setBusyId(deletingId);
    const result = await deleteStageAction(deletingId);
    setBusyId(null);
    setDeletingId(null);
    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    toast.success("Etapa eliminada.");
    router.refresh();
  }

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline">
            <Settings2 /> Editar pipeline
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar pipeline</DialogTitle>
            <DialogDescription>Configura las etapas por las que pasan tus leads.</DialogDescription>
          </DialogHeader>

          <div className="max-h-96 space-y-2 overflow-y-auto">
            {sorted.map((stage, index) => (
              <div key={stage.id} className="flex items-center gap-2 rounded-lg border border-border p-2">
                <div className="flex flex-col">
                  <button
                    type="button"
                    disabled={index === 0 || busyId === stage.id}
                    onClick={() => handleMove(stage.id, "up")}
                    className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                  >
                    <ArrowUp className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={index === sorted.length - 1 || busyId === stage.id}
                    onClick={() => handleMove(stage.id, "down")}
                    className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                  >
                    <ArrowDown className="size-3.5" />
                  </button>
                </div>

                <Input
                  defaultValue={stage.name}
                  onBlur={(e) => handleRename(stage, e.target.value)}
                  className="h-8 flex-1"
                />

                <label className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Switch
                    checked={stage.is_won}
                    onCheckedChange={(checked) => handleToggle(stage, "isWon", checked)}
                  />
                  Ganado
                </label>
                <label className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Switch
                    checked={stage.is_lost}
                    onCheckedChange={(checked) => handleToggle(stage, "isLost", checked)}
                  />
                  Perdido
                </label>

                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setDeletingId(stage.id)}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 />
                </Button>
              </div>
            ))}
          </div>

          <form onSubmit={handleCreate} className="flex items-center gap-2 border-t border-border pt-3">
            <Input
              value={newStageName}
              onChange={(e) => setNewStageName(e.target.value)}
              placeholder="Nombre de la nueva etapa"
              className="flex-1"
            />
            <Button type="submit" size="sm" disabled={creating || !newStageName.trim()}>
              <Plus /> Agregar
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmationDialog
        open={Boolean(deletingId)}
        onOpenChange={(o) => !o && setDeletingId(null)}
        title="¿Eliminar esta etapa?"
        description="No se puede eliminar si tiene leads asignados."
        confirmLabel="Eliminar"
        destructive
        loading={Boolean(busyId)}
        onConfirm={handleDelete}
      />
    </>
  );
}

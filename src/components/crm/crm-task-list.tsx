"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckSquare } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState } from "@/components/ui/empty-state";
import { CrmTaskFormDialog } from "@/components/crm/crm-task-form-dialog";
import { toggleTaskDoneAction, type CrmOwner } from "@/app/(app)/crm/leads/task-note-tag-actions";
import type { CrmTask } from "@/types/database";

function formatDueAt(iso: string) {
  return new Date(iso).toLocaleString("es-CO", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function CrmTaskList({ tasks, ...owner }: { tasks: CrmTask[] } & CrmOwner) {
  const router = useRouter();
  const [pendingId, setPendingId] = React.useState<string | null>(null);

  const sorted = [...tasks].sort((a, b) => {
    if (Boolean(a.done_at) !== Boolean(b.done_at)) return a.done_at ? 1 : -1;
    if (!a.due_at && !b.due_at) return 0;
    if (!a.due_at) return 1;
    if (!b.due_at) return -1;
    return new Date(a.due_at).getTime() - new Date(b.due_at).getTime();
  });

  async function handleToggle(task: CrmTask, done: boolean) {
    setPendingId(task.id);
    const result = await toggleTaskDoneAction(owner, task.id, done);
    setPendingId(null);

    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-heading text-sm font-semibold text-foreground">Tareas</h3>
        <CrmTaskFormDialog owner={owner} />
      </div>

      {sorted.length === 0 ? (
        <EmptyState icon={CheckSquare} title="Sin tareas" description="Agrega un pendiente para dar seguimiento." />
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-card">
          {sorted.map((task) => (
            <li key={task.id} className="flex items-start gap-3 p-3">
              <Checkbox
                checked={Boolean(task.done_at)}
                disabled={pendingId === task.id}
                onCheckedChange={(checked) => handleToggle(task, checked === true)}
                className="mt-0.5"
              />
              <div className="min-w-0 flex-1">
                <p className={`text-sm ${task.done_at ? "text-muted-foreground line-through" : "text-foreground"}`}>
                  {task.title}
                </p>
                {task.due_at && (
                  <p className="text-xs text-muted-foreground">{formatDueAt(task.due_at)}</p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

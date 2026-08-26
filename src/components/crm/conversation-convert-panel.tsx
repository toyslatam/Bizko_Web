"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Contact, UserPlus, ListTodo, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  convertConversationToLeadAction,
  convertConversationToCustomerAction,
  createTaskFromConversationAction,
} from "@/app/(app)/crm/bandeja/actions";
import type { CrmConversation } from "@/types/database";

export function ConversationConvertPanel({ conversation }: { conversation: CrmConversation }) {
  const router = useRouter();
  const [loading, setLoading] = React.useState<string | null>(null);
  const [taskOpen, setTaskOpen] = React.useState(false);
  const [taskTitle, setTaskTitle] = React.useState("");
  const [taskDueAt, setTaskDueAt] = React.useState("");

  const isLinked = Boolean(conversation.lead_id || conversation.customer_id);

  async function handleConvertLead() {
    setLoading("lead");
    const result = await convertConversationToLeadAction(conversation.id);
    setLoading(null);
    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    toast.success("Lead creado a partir de esta conversación.");
    router.refresh();
  }

  async function handleConvertCustomer() {
    setLoading("customer");
    const result = await convertConversationToCustomerAction(conversation.id);
    setLoading(null);
    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    toast.success("Cliente creado a partir de esta conversación.");
    router.refresh();
  }

  async function handleCreateTask(e: React.FormEvent) {
    e.preventDefault();
    setLoading("task");
    const result = await createTaskFromConversationAction(
      conversation.id,
      taskTitle,
      taskDueAt || null,
    );
    setLoading(null);
    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    toast.success("Tarea creada.");
    setTaskOpen(false);
    setTaskTitle("");
    setTaskDueAt("");
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={handleConvertLead}
        disabled={Boolean(conversation.lead_id) || loading !== null}
      >
        <Contact />
        {conversation.lead_id ? "Ya es lead" : loading === "lead" ? "Creando..." : "Convertir en lead"}
      </Button>

      <Button
        variant="outline"
        size="sm"
        onClick={handleConvertCustomer}
        disabled={Boolean(conversation.customer_id) || loading !== null}
      >
        <UserPlus />
        {conversation.customer_id
          ? "Ya es cliente"
          : loading === "customer"
            ? "Creando..."
            : "Convertir en cliente"}
      </Button>

      {isLinked ? (
        <Dialog open={taskOpen} onOpenChange={setTaskOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <ListTodo /> Crear tarea
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Nueva tarea</DialogTitle>
              <DialogDescription>
                Se vinculará al {conversation.lead_id ? "lead" : "cliente"} de esta conversación.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateTask} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="taskTitle">Título</Label>
                <Input
                  id="taskTitle"
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  placeholder="Ej. Llamar para confirmar pedido"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="taskDueAt">Fecha límite</Label>
                <Input
                  id="taskDueAt"
                  type="datetime-local"
                  value={taskDueAt}
                  onChange={(e) => setTaskDueAt(e.target.value)}
                />
              </div>
              <DialogFooter>
                <Button type="submit" disabled={loading === "task"}>
                  {loading === "task" ? "Guardando..." : "Crear tarea"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      ) : (
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <Button variant="outline" size="sm" disabled>
                <ListTodo /> Crear tarea
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>Convierte esta conversación en lead o cliente primero.</TooltipContent>
        </Tooltip>
      )}

      <Tooltip>
        <TooltipTrigger asChild>
          <span>
            <Button variant="outline" size="sm" asChild>
              <Link href="/pedidos">
                <ShoppingCart /> Ir a pedidos
              </Link>
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent>
          Crear un pedido necesita elegir productos y precios — hazlo desde Pedidos.
        </TooltipContent>
      </Tooltip>
    </div>
  );
}

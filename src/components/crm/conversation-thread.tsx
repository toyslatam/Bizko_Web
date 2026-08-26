"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { logOutboundMessageAction } from "@/app/(app)/crm/bandeja/actions";
import type { CrmMessage } from "@/types/database";

function formatTime(value: string) {
  return new Date(value).toLocaleString("es-CO", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function MessageBubble({ message }: { message: CrmMessage }) {
  const outbound = message.direction === "outbound";
  return (
    <div className={cn("flex", outbound ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[80%] rounded-2xl px-3.5 py-2 text-sm",
          outbound
            ? "rounded-br-sm bg-brand text-brand-foreground"
            : "rounded-bl-sm bg-muted text-foreground",
        )}
      >
        <p className="whitespace-pre-wrap">{message.body}</p>
        <p
          className={cn(
            "mt-1 text-[11px]",
            outbound ? "text-brand-foreground/70" : "text-muted-foreground",
          )}
        >
          {formatTime(message.sent_at)}
        </p>
      </div>
    </div>
  );
}

export function ConversationThread({
  conversationId,
  messages,
}: {
  conversationId: string;
  messages: CrmMessage[];
}) {
  const router = useRouter();
  const [body, setBody] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setSaving(true);
    const result = await logOutboundMessageAction(conversationId, body);
    setSaving(false);

    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    setBody("");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4">
        {messages.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Todavía no hay mensajes en esta conversación.
          </p>
        ) : (
          messages.map((m) => <MessageBubble key={m.id} message={m} />)
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-2 rounded-xl border border-border bg-card p-4">
        <p className="text-xs text-muted-foreground">
          Registra lo que enviaste por este canal — bizko todavía no envía mensajes automáticamente.
        </p>
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
          placeholder="Escribe lo que le respondiste al contacto..."
        />
        <div className="flex justify-end">
          <Button type="submit" disabled={saving || !body.trim()}>
            <Send /> {saving ? "Guardando..." : "Registrar respuesta"}
          </Button>
        </div>
      </form>
    </div>
  );
}

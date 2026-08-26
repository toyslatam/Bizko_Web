"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { createNoteAction, type CrmOwner } from "@/app/(app)/crm/leads/task-note-tag-actions";

export function CrmNoteForm({ owner }: { owner: CrmOwner }) {
  const router = useRouter();
  const [body, setBody] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setSaving(true);
    const result = await createNoteAction(owner, body);
    setSaving(false);

    if ("error" in result) {
      toast.error(result.error);
      return;
    }

    setBody("");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <Textarea
        rows={2}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Escribe una nota..."
      />
      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={saving || !body.trim()}>
          {saving ? "Guardando..." : "Agregar nota"}
        </Button>
      </div>
    </form>
  );
}

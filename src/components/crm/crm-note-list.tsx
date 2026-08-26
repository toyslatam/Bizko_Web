import { StickyNote } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { CrmNoteForm } from "@/components/crm/crm-note-form";
import type { CrmOwner } from "@/app/(app)/crm/leads/task-note-tag-actions";
import type { CrmNote } from "@/types/database";

function formatNoteDate(iso: string) {
  return new Date(iso).toLocaleString("es-CO", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function CrmNoteList({ notes, owner }: { notes: CrmNote[]; owner: CrmOwner }) {
  return (
    <div className="space-y-3">
      <h3 className="font-heading text-sm font-semibold text-foreground">Notas</h3>
      <CrmNoteForm owner={owner} />

      {notes.length === 0 ? (
        <EmptyState icon={StickyNote} title="Sin notas" description="Las notas que agregues aparecerán aquí." />
      ) : (
        <ul className="space-y-2">
          {notes.map((note) => (
            <li key={note.id} className="rounded-xl border border-border bg-card p-3">
              <p className="text-sm whitespace-pre-wrap text-foreground">{note.body}</p>
              <p className="mt-1 text-xs text-muted-foreground">{formatNoteDate(note.created_at)}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, X, Tag as TagIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { addTagAction, removeTagAction, type CrmOwner } from "@/app/(app)/crm/leads/task-note-tag-actions";
import type { CrmTag } from "@/types/database";

export function CrmTagPicker({
  currentTags,
  companyTags,
  owner,
}: {
  currentTags: CrmTag[];
  companyTags: CrmTag[];
  owner: CrmOwner;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [pending, setPending] = React.useState(false);

  const currentIds = new Set(currentTags.map((t) => t.id));
  const available = companyTags.filter((t) => !currentIds.has(t.id));
  const canCreate = search.trim().length > 0 && !companyTags.some((t) => t.name.toLowerCase() === search.trim().toLowerCase());

  async function handleAdd(name: string) {
    setPending(true);
    const result = await addTagAction(owner, name);
    setPending(false);
    setOpen(false);
    setSearch("");

    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    router.refresh();
  }

  async function handleRemove(tagId: string) {
    const result = await removeTagAction(owner, tagId);
    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <h3 className="font-heading text-sm font-semibold text-foreground">Etiquetas</h3>
      <div className="flex flex-wrap items-center gap-1.5">
        {currentTags.map((tag) => (
          <Badge key={tag.id} variant="outline" className="gap-1 pr-1">
            <span className="size-1.5 rounded-full" style={{ backgroundColor: tag.color }} />
            {tag.name}
            <button
              type="button"
              onClick={() => handleRemove(tag.id)}
              className="ml-0.5 text-muted-foreground hover:text-destructive"
            >
              <X className="size-3" />
            </button>
          </Badge>
        ))}

        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" disabled={pending}>
              <Plus /> Agregar
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-0" align="start">
            <Command>
              <CommandInput placeholder="Buscar o crear..." value={search} onValueChange={setSearch} />
              <CommandList>
                {available.length === 0 && !canCreate && (
                  <CommandEmpty>Sin etiquetas disponibles.</CommandEmpty>
                )}
                <CommandGroup>
                  {available.map((tag) => (
                    <CommandItem key={tag.id} value={tag.name} onSelect={() => handleAdd(tag.name)}>
                      <TagIcon className="size-3.5 text-muted-foreground" />
                      {tag.name}
                    </CommandItem>
                  ))}
                  {canCreate && (
                    <CommandItem value={search} onSelect={() => handleAdd(search)}>
                      <Plus className="size-3.5 text-muted-foreground" />
                      Crear &quot;{search.trim()}&quot;
                    </CommandItem>
                  )}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}

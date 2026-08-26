"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { setConversationStatusAction } from "@/app/(app)/crm/bandeja/actions";
import { CONVERSATION_STATUS_LABELS, CONVERSATION_STATUSES } from "@/lib/crm-channels";
import type { CrmConversationStatus } from "@/types/database";

export function ConversationStatusSelect({
  conversationId,
  status,
}: {
  conversationId: string;
  status: CrmConversationStatus;
}) {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);

  async function handleChange(value: string) {
    const nextStatus = value as CrmConversationStatus;
    setLoading(true);
    const result = await setConversationStatusAction(conversationId, nextStatus);
    setLoading(false);

    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    toast.success(`Conversación marcada como "${CONVERSATION_STATUS_LABELS[nextStatus]}".`);
    router.refresh();
  }

  return (
    <Select value={status} onValueChange={handleChange} disabled={loading}>
      <SelectTrigger className="w-40">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {CONVERSATION_STATUSES.map((s) => (
          <SelectItem key={s} value={s}>
            {CONVERSATION_STATUS_LABELS[s]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

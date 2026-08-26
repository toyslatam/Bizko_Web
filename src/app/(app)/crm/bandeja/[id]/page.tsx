import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/lib/auth/session";
import { ConversationStatusSelect } from "@/components/crm/conversation-status-select";
import { ConversationThread } from "@/components/crm/conversation-thread";
import { ConversationConvertPanel } from "@/components/crm/conversation-convert-panel";
import { CHANNEL_TYPE_ICONS, CHANNEL_TYPE_LABELS } from "@/lib/crm-channels";
import type { CrmConversation, CrmMessage } from "@/types/database";

export default async function ConversationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSessionContext();
  if (!session) redirect("/login");
  if (!session.activeCompany) redirect("/onboarding");

  const { id } = await params;
  const supabase = await createClient();

  const [{ data: conversationData }, { data: messagesData }] = await Promise.all([
    supabase.from("crm_conversations").select("*").eq("id", id).maybeSingle(),
    supabase.from("crm_messages").select("*").eq("conversation_id", id).order("sent_at", { ascending: true }),
  ]);

  const conversation = conversationData as CrmConversation | null;
  if (!conversation) notFound();
  const messages = (messagesData ?? []) as CrmMessage[];
  const ChannelIcon = CHANNEL_TYPE_ICONS[conversation.channel_type];

  return (
    <div className="max-w-2xl">
      <Link
        href="/crm/bandeja"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Bandeja de entrada
      </Link>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand/15 text-brand">
            <ChannelIcon className="size-5" />
          </span>
          <div>
            <h1 className="font-heading text-xl font-semibold text-foreground">
              {conversation.contact_name}
            </h1>
            <p className="text-sm text-muted-foreground">
              {CHANNEL_TYPE_LABELS[conversation.channel_type]}
              {conversation.contact_handle && ` · ${conversation.contact_handle}`}
            </p>
          </div>
        </div>
        <ConversationStatusSelect conversationId={conversation.id} status={conversation.status} />
      </div>

      <div className="mt-4">
        <ConversationConvertPanel conversation={conversation} />
      </div>

      <div className="mt-6">
        <ConversationThread conversationId={conversation.id} messages={messages} />
      </div>
    </div>
  );
}

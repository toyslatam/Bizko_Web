import { redirect } from "next/navigation";
import { Inbox } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/lib/auth/session";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConversationToolbar } from "@/components/crm/conversation-toolbar";
import { ConversationList, type ConversationRow } from "@/components/crm/conversation-list";
import { ConversationRegisterDialog } from "@/components/crm/conversation-register-dialog";
import { ChannelStatusList } from "@/components/crm/channel-status-list";
import type { CrmChannel, CrmChannelType, CrmConversation, CrmConversationStatus, Profile } from "@/types/database";

interface PageProps {
  searchParams: Promise<{ channel?: string; status?: string; tab?: string }>;
}

export default async function BandejaPage({ searchParams }: PageProps) {
  const session = await getSessionContext();
  if (!session) redirect("/login");
  if (!session.activeCompany) redirect("/onboarding");

  const { channel, status, tab } = await searchParams;
  const supabase = await createClient();
  const companyId = session.activeCompany.id;

  let query = supabase
    .from("crm_conversations")
    .select("*")
    .eq("company_id", companyId)
    .order("last_message_at", { ascending: false });

  if (channel) query = query.eq("channel_type", channel as CrmChannelType);
  if (status) query = query.eq("status", status as CrmConversationStatus);

  const [{ data: conversationsData }, { data: channelsData }] = await Promise.all([
    query,
    supabase.from("crm_channels").select("*").eq("company_id", companyId),
  ]);

  const conversations = (conversationsData ?? []) as CrmConversation[];
  const channels = (channelsData ?? []) as CrmChannel[];

  const assignedIds = [...new Set(conversations.map((c) => c.assigned_to).filter((v): v is string => Boolean(v)))];
  const profileById = new Map<string, Profile>();
  if (assignedIds.length > 0) {
    const { data: profilesData } = await supabase.from("profiles").select("*").in("id", assignedIds);
    for (const p of (profilesData ?? []) as Profile[]) profileById.set(p.id, p);
  }

  const conversationRows: ConversationRow[] = conversations.map((c) => {
    const profile = c.assigned_to ? profileById.get(c.assigned_to) : null;
    const assigneeName = profile
      ? [profile.first_name, profile.last_name].filter(Boolean).join(" ") || profile.email.split("@")[0]
      : null;
    return { ...c, assigneeName };
  });

  const hasFilters = Boolean(channel) || Boolean(status);
  const hasConnectedChannel = channels.some((c) => c.status === "connected");
  const isTrulyEmpty = conversations.length === 0 && !hasConnectedChannel && !hasFilters;

  return (
    <div>
      <PageHeader
        title="Bandeja de entrada"
        description="Conversaciones con tus contactos, por canal."
        actions={<ConversationRegisterDialog />}
      />

      <Tabs defaultValue={tab === "canales" ? "canales" : "bandeja"}>
        <TabsList>
          <TabsTrigger value="bandeja">Bandeja</TabsTrigger>
          <TabsTrigger value="canales">Canales</TabsTrigger>
        </TabsList>

        <TabsContent value="bandeja" className="mt-4">
          {isTrulyEmpty ? (
            <EmptyState
              icon={Inbox}
              title="Todavía no tienes canales conectados"
              description="Cuando conectes WhatsApp, Instagram u otro canal, las conversaciones aparecerán aquí automáticamente. Mientras tanto, puedes registrar una conversación manualmente."
              action={<ConversationRegisterDialog />}
            />
          ) : (
            <div className="space-y-4">
              <ConversationToolbar />
              {conversationRows.length > 0 ? (
                <ConversationList conversations={conversationRows} />
              ) : (
                <EmptyState
                  icon={Inbox}
                  title="Sin resultados"
                  description="No encontramos conversaciones con esos filtros."
                />
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="canales" className="mt-4">
          <ChannelStatusList channels={channels} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

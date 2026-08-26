import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { MobileList, MobileListItem } from "@/components/ui/mobile-list";
import { Badge } from "@/components/ui/badge";
import { CHANNEL_TYPE_ICONS, CHANNEL_TYPE_LABELS, CONVERSATION_STATUS_LABELS } from "@/lib/crm-channels";
import type { CrmConversation, CrmConversationStatus } from "@/types/database";

export interface ConversationRow extends CrmConversation {
  assigneeName: string | null;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function StatusBadge({ status }: { status: CrmConversationStatus }) {
  return (
    <Badge variant={status === "open" ? "default" : status === "pending" ? "outline" : "secondary"}>
      {CONVERSATION_STATUS_LABELS[status]}
    </Badge>
  );
}

function ChannelTag({ channel }: { channel: CrmConversation["channel_type"] }) {
  const Icon = CHANNEL_TYPE_ICONS[channel];
  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
      <Icon className="size-3.5" /> {CHANNEL_TYPE_LABELS[channel]}
    </span>
  );
}

export function ConversationList({ conversations }: { conversations: ConversationRow[] }) {
  return (
    <>
      <div className="hidden overflow-hidden rounded-xl border border-border md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Contacto</TableHead>
              <TableHead>Canal</TableHead>
              <TableHead>Último mensaje</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>Responsable</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {conversations.map((c) => (
              <TableRow key={c.id} className="cursor-pointer">
                <TableCell className="font-medium text-foreground">
                  <Link href={`/crm/bandeja/${c.id}`} className="block">
                    {c.contact_name}
                  </Link>
                </TableCell>
                <TableCell>
                  <ChannelTag channel={c.channel_type} />
                </TableCell>
                <TableCell className="max-w-64 truncate text-muted-foreground">
                  {c.last_message_preview ?? "—"}
                </TableCell>
                <TableCell className="text-muted-foreground">{formatDate(c.last_message_at)}</TableCell>
                <TableCell className="text-muted-foreground">{c.assigneeName ?? "Sin asignar"}</TableCell>
                <TableCell>
                  <StatusBadge status={c.status} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <MobileList>
        {conversations.map((c) => (
          <MobileListItem
            key={c.id}
            href={`/crm/bandeja/${c.id}`}
            title={c.contact_name}
            subtitle={c.last_message_preview ?? CHANNEL_TYPE_LABELS[c.channel_type]}
            trailing={<StatusBadge status={c.status} />}
          />
        ))}
      </MobileList>
    </>
  );
}

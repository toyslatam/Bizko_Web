import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { CHANNEL_CONNECT_INFO, CHANNEL_TYPE_ICONS, CHANNEL_TYPE_LABELS, CHANNEL_TYPES } from "@/lib/crm-channels";
import type { CrmChannel } from "@/types/database";

/**
 * Estado de conexión de cada canal (§4) — ninguno tiene una integración real
 * todavía (falta VPS + credenciales de Meta/LinkedIn/email), así que este es
 * un panel informativo, no un flujo de conexión funcional.
 */
export function ChannelStatusList({ channels }: { channels: CrmChannel[] }) {
  const byType = new Map(channels.map((c) => [c.channel_type, c]));

  return (
    <div className="divide-y divide-border rounded-xl border border-border bg-card">
      {CHANNEL_TYPES.map((type) => {
        const channel = byType.get(type);
        const connected = channel?.status === "connected";
        const Icon = CHANNEL_TYPE_ICONS[type];

        return (
          <div key={type} className="flex items-center gap-3 px-4 py-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <Icon className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground">{CHANNEL_TYPE_LABELS[type]}</p>
              <p className="text-xs text-muted-foreground">{CHANNEL_CONNECT_INFO[type]}</p>
            </div>
            <Badge variant={connected ? "default" : "outline"}>
              {connected ? "Conectado" : "No conectado"}
            </Badge>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button variant="outline" size="sm" disabled>
                    Conectar
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>{CHANNEL_CONNECT_INFO[type]}</TooltipContent>
            </Tooltip>
          </div>
        );
      })}
    </div>
  );
}

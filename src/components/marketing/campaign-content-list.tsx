import { CAMPAIGN_CONTENT_TYPE_LABELS } from "@/lib/marketing";
import { CHANNEL_TYPE_LABELS } from "@/lib/crm-channels";
import type { MarketingCampaignContent } from "@/types/database";

export function CampaignContentList({ content }: { content: MarketingCampaignContent[] }) {
  return (
    <ul className="space-y-3">
      {content.map((item) => (
        <li key={item.id} className="rounded-lg border border-border bg-muted/30 p-3">
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <span className="rounded-full bg-muted px-2 py-0.5 font-medium text-foreground">
              {CAMPAIGN_CONTENT_TYPE_LABELS[item.content_type]}
            </span>
            {item.channel && <span>{CHANNEL_TYPE_LABELS[item.channel]}</span>}
            <span>· {item.generated_by === "ai" ? "Generado con IA" : "Escrito a mano"}</span>
          </div>
          <p className="mt-1.5 text-sm whitespace-pre-wrap text-foreground">{item.body}</p>
          {item.media_url && (
            <a
              href={item.media_url}
              target="_blank"
              rel="noreferrer"
              className="mt-1.5 inline-block text-xs text-brand hover:underline"
            >
              Ver adjunto
            </a>
          )}
        </li>
      ))}
    </ul>
  );
}

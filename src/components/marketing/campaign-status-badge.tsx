import { Badge } from "@/components/ui/badge";
import { CAMPAIGN_STATUS_LABELS } from "@/lib/marketing";
import type { CampaignStatus } from "@/types/database";

const VARIANT_BY_STATUS: Record<CampaignStatus, "outline" | "secondary" | "default"> = {
  draft: "outline",
  review: "secondary",
  approved: "secondary",
  scheduled: "secondary",
  published: "default",
  finished: "outline",
};

export function CampaignStatusBadge({ status }: { status: CampaignStatus }) {
  return <Badge variant={VARIANT_BY_STATUS[status]}>{CAMPAIGN_STATUS_LABELS[status]}</Badge>;
}

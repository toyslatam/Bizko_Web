"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { UserCheck, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { convertLeadToCustomerAction } from "@/app/(app)/crm/leads/actions";

export function ConvertLeadButton({ leadId, customerId }: { leadId: string; customerId: string | null }) {
  const router = useRouter();
  const [converting, setConverting] = React.useState(false);

  if (customerId) {
    return (
      <Button variant="outline" size="sm" asChild>
        <Link href={`/clientes/${customerId}`}>
          <ExternalLink /> Ver cliente
        </Link>
      </Button>
    );
  }

  async function handleConvert() {
    setConverting(true);
    const result = await convertLeadToCustomerAction(leadId);
    setConverting(false);

    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    toast.success("Lead convertido en cliente.");
    router.push(`/clientes/${result.customerId}`);
  }

  return (
    <Button size="sm" onClick={handleConvert} disabled={converting}>
      <UserCheck /> {converting ? "Convirtiendo..." : "Convertir en cliente"}
    </Button>
  );
}

"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ComboItemRemoveButton({
  onRemove,
}: {
  onRemove: () => Promise<{ ok: true } | { error: string }>;
}) {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);

  async function handleClick() {
    setLoading(true);
    const result = await onRemove();
    setLoading(false);

    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    toast.success("Producto quitado del combo.");
    router.refresh();
  }

  return (
    <Button variant="ghost" size="icon-sm" disabled={loading} onClick={handleClick}>
      <X />
    </Button>
  );
}

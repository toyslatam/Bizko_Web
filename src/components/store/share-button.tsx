"use client";

import * as React from "react";
import { toast } from "sonner";
import { Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ShareButton({ title, url }: { title: string; url: string }) {
  async function handleShare() {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title, url });
      } catch {
        // el usuario canceló el share sheet — no hacer nada.
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Enlace copiado");
    } catch {
      toast.error("No pudimos copiar el enlace.");
    }
  }

  return (
    <Button variant="ghost" size="icon-sm" onClick={handleShare} aria-label="Compartir">
      <Share2 />
    </Button>
  );
}

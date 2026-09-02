"use client";

import * as React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ProductImage } from "@/types/database";

type ActionResult = { ok: true } | { error: string };

export function GalleryThumbnail({
  image,
  isFirst,
  isLast,
  onRemove,
  onMoveUp,
  onMoveDown,
}: {
  image: ProductImage;
  isFirst: boolean;
  isLast: boolean;
  onRemove: () => Promise<ActionResult>;
  onMoveUp?: () => Promise<ActionResult>;
  onMoveDown?: () => Promise<ActionResult>;
}) {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);

  async function run(action: () => Promise<ActionResult>, successMessage?: string) {
    setLoading(true);
    const result = await action();
    setLoading(false);

    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    if (successMessage) toast.success(successMessage);
    router.refresh();
  }

  return (
    <div className="group relative size-24 shrink-0 overflow-hidden rounded-xl border border-border bg-muted">
      <Image src={image.image_url} alt="" width={96} height={96} className="size-full object-cover" />

      <button
        type="button"
        disabled={loading}
        onClick={() => run(onRemove, "Foto eliminada.")}
        className="absolute top-1 right-1 flex size-5 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
      >
        <X className="size-3" />
      </button>

      <div className="absolute inset-x-0 bottom-0 flex justify-center gap-1 bg-black/50 py-0.5">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          disabled={loading || isFirst || !onMoveUp}
          onClick={() => onMoveUp && run(onMoveUp)}
          className="size-5 text-white hover:bg-white/20 hover:text-white"
        >
          <ChevronLeft className="size-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          disabled={loading || isLast || !onMoveDown}
          onClick={() => onMoveDown && run(onMoveDown)}
          className="size-5 text-white hover:bg-white/20 hover:text-white"
        >
          <ChevronRight className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}

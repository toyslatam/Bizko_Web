"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ImagePlus } from "lucide-react";
import { Label } from "@/components/ui/label";
import { uploadCompanyFile } from "@/lib/storage";

export function GalleryUploadButton({
  companyId,
  onUpload,
}: {
  companyId: string;
  onUpload: (imageUrl: string) => Promise<{ ok: true; id: string } | { error: string }>;
}) {
  const router = useRouter();
  const [uploading, setUploading] = React.useState(false);
  const inputId = React.useId();

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setUploading(true);
    try {
      const url = await uploadCompanyFile("product-images", companyId, file);
      const result = await onUpload(url);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("Foto agregada.");
      router.refresh();
    } catch {
      toast.error("No pudimos subir la imagen.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Label
        htmlFor={inputId}
        className="inline-flex cursor-pointer items-center gap-1.5 text-sm font-medium text-brand"
      >
        <ImagePlus className="size-4" />
        {uploading ? "Subiendo..." : "Agregar foto"}
      </Label>
      <input
        id={inputId}
        type="file"
        accept="image/*"
        className="hidden"
        disabled={uploading}
        onChange={handleChange}
      />
    </div>
  );
}

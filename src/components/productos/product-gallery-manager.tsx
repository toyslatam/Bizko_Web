import { Images } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { GalleryUploadButton } from "@/components/productos/gallery-upload-button";
import { GalleryThumbnail } from "@/components/productos/gallery-thumbnail";
import {
  addGalleryImageAction,
  removeGalleryImageAction,
  reorderGalleryImagesAction,
} from "@/app/(app)/productos/gallery-actions";
import type { ProductImage } from "@/types/database";

export function ProductGalleryManager({
  productId,
  companyId,
  images,
}: {
  productId: string;
  companyId: string;
  images: ProductImage[];
}) {
  const sorted = [...images].sort((a, b) => a.sort_order - b.sort_order);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold text-foreground">Galería de fotos</p>
        <GalleryUploadButton
          companyId={companyId}
          onUpload={addGalleryImageAction.bind(null, productId)}
        />
      </div>

      {sorted.length === 0 ? (
        <EmptyState
          icon={Images}
          title="Sin fotos adicionales"
          description="Agrega más fotos del producto para mostrarlas en un carrusel en la ficha pública."
        />
      ) : (
        <div className="flex flex-wrap gap-3">
          {sorted.map((image, index) => (
            <GalleryThumbnail
              key={image.id}
              image={image}
              isFirst={index === 0}
              isLast={index === sorted.length - 1}
              onRemove={removeGalleryImageAction.bind(null, image.id, productId)}
              onMoveUp={
                index === 0
                  ? undefined
                  : reorderGalleryImagesAction.bind(
                      null,
                      productId,
                      swap(sorted, index, index - 1).map((i) => i.id),
                    )
              }
              onMoveDown={
                index === sorted.length - 1
                  ? undefined
                  : reorderGalleryImagesAction.bind(
                      null,
                      productId,
                      swap(sorted, index, index + 1).map((i) => i.id),
                    )
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

function swap<T>(arr: T[], i: number, j: number): T[] {
  const copy = [...arr];
  [copy[i], copy[j]] = [copy[j], copy[i]];
  return copy;
}

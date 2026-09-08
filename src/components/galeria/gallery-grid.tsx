import Image from "next/image";
import { DeleteGalleryItemButton } from "@/components/galeria/delete-gallery-item-button";

export interface GalleryItemWithNames {
  id: string;
  image_url: string;
  description: string | null;
  service_name: string | null;
  professional_name: string | null;
}

export function GalleryGrid({ items }: { items: GalleryItemWithNames[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {items.map((item) => (
        <div
          key={item.id}
          className="group relative overflow-hidden rounded-xl border border-border bg-card"
        >
          <div className="relative aspect-square w-full overflow-hidden bg-muted">
            <Image
              src={item.image_url}
              alt={item.description ?? ""}
              fill
              sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
              className="object-cover"
            />
          </div>
          <div className="absolute inset-x-0 top-0 flex justify-end p-2 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
            <DeleteGalleryItemButton itemId={item.id} />
          </div>
          {(item.description || item.service_name || item.professional_name) && (
            <div className="space-y-0.5 p-2.5">
              {item.description && (
                <p className="line-clamp-2 text-sm text-foreground">{item.description}</p>
              )}
              {(item.service_name || item.professional_name) && (
                <p className="text-xs text-muted-foreground">
                  {[item.service_name, item.professional_name].filter(Boolean).join(" · ")}
                </p>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

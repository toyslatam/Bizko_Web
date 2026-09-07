import Image from "next/image";
import Link from "next/link";
import { Clock, Scissors } from "lucide-react";
import { formatCurrencyCents } from "@/lib/format";
import type { PublicService } from "@/types/database";

export function ServiceCard({ slug, service }: { slug: string; service: PublicService }) {
  return (
    <Link
      href={`/store/${slug}/reservar/${service.id}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-all duration-200 lg:hover:-translate-y-0.5 lg:hover:shadow-lg"
    >
      <div className="relative aspect-square w-full overflow-hidden bg-muted">
        {service.image_url ? (
          <Image
            src={service.image_url}
            alt=""
            fill
            className="object-cover"
            sizes="(min-width: 1280px) 22vw, (min-width: 1024px) 30vw, 45vw"
          />
        ) : (
          <div className="flex size-full items-center justify-center">
            <Scissors className="size-8 text-muted-foreground" />
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <p className="line-clamp-2 text-sm font-medium text-foreground">{service.name}</p>
        {service.description && (
          <p className="line-clamp-2 text-xs text-muted-foreground">{service.description}</p>
        )}
        <div className="mt-auto flex items-center justify-between pt-1">
          <span className="text-sm font-semibold text-foreground">{formatCurrencyCents(service.price_cents)}</span>
          {service.duration_minutes && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="size-3" /> {service.duration_minutes} min
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

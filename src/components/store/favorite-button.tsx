"use client";

import * as React from "react";
import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";

function favoritesKey(slug: string) {
  return `bizko_favorites_${slug}`;
}

function readFavorites(slug: string): string[] {
  try {
    const raw = localStorage.getItem(favoritesKey(slug));
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function writeFavorites(slug: string, ids: string[]) {
  try {
    localStorage.setItem(favoritesKey(slug), JSON.stringify(ids));
  } catch {
    // localStorage no disponible (modo privado, etc.) — el favorito no persiste.
  }
}

export function FavoriteButton({
  slug,
  productId,
  className,
}: {
  slug: string;
  productId: string;
  className?: string;
}) {
  const [isFavorite, setIsFavorite] = React.useState(false);

  React.useEffect(() => {
    // Lee localStorage tras el montaje: no existe en el servidor, así que
    // el estado inicial real no puede derivarse durante el render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsFavorite(readFavorites(slug).includes(productId));
  }, [slug, productId]);

  function handleToggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const current = readFavorites(slug);
    const next = current.includes(productId)
      ? current.filter((id) => id !== productId)
      : [...current, productId];
    writeFavorites(slug, next);
    setIsFavorite(next.includes(productId));
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      aria-label={isFavorite ? "Quitar de favoritos" : "Agregar a favoritos"}
      aria-pressed={isFavorite}
      className={cn(
        "flex size-7 items-center justify-center rounded-full bg-white/90 text-foreground shadow-sm backdrop-blur-sm transition-colors hover:bg-white",
        className,
      )}
    >
      <Heart className={cn("size-3.5", isFavorite ? "fill-red-500 text-red-500" : "text-foreground/60")} />
    </button>
  );
}

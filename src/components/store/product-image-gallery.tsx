"use client";

import * as React from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, Package } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PublicProductImage } from "@/types/database";

export function ProductImageGallery({
  primaryImageUrl,
  images,
}: {
  primaryImageUrl: string | null;
  images: PublicProductImage[];
}) {
  const slides = React.useMemo(() => {
    const extra = [...images].sort((a, b) => a.sort_order - b.sort_order).map((img) => img.image_url);
    return primaryImageUrl ? [primaryImageUrl, ...extra] : extra;
  }, [primaryImageUrl, images]);

  const [activeIndex, setActiveIndex] = React.useState(0);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const slideRefs = React.useRef<(HTMLDivElement | null)[]>([]);

  React.useEffect(() => {
    const container = containerRef.current;
    if (!container || slides.length <= 1) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (!visible) return;
        const index = slideRefs.current.findIndex((el) => el === visible.target);
        if (index !== -1) setActiveIndex(index);
      },
      { root: container, threshold: 0.6 },
    );

    for (const el of slideRefs.current) {
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [slides.length]);

  if (slides.length === 0) {
    return (
      <div className="flex size-full items-center justify-center">
        <Package className="size-12 text-muted-foreground" />
      </div>
    );
  }

  if (slides.length === 1) {
    return <Image src={slides[0]} alt="" fill className="object-cover" sizes="(min-width: 1024px) 500px, 600px" />;
  }

  function scrollToSlide(index: number) {
    const container = containerRef.current;
    const target = slideRefs.current[index];
    if (!container || !target) return;
    container.scrollTo({ left: target.offsetLeft, behavior: "smooth" });
  }

  return (
    <div className="group/gallery relative size-full">
      <div
        ref={containerRef}
        className="flex size-full snap-x snap-mandatory overflow-x-auto scroll-smooth [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {slides.map((url, i) => (
          <div
            key={i}
            ref={(el) => {
              slideRefs.current[i] = el;
            }}
            className="relative size-full shrink-0 snap-center"
          >
            <Image
              src={url}
              alt=""
              fill
              className="object-cover"
              sizes="(min-width: 1024px) 500px, 600px"
              priority={i === 0}
            />
          </div>
        ))}
      </div>

      {activeIndex > 0 && (
        <button
          type="button"
          onClick={() => scrollToSlide(activeIndex - 1)}
          aria-label="Foto anterior"
          className="absolute top-1/2 left-3 flex size-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white opacity-0 backdrop-blur-sm transition-opacity group-hover/gallery:opacity-100 hover:bg-black/60 focus-visible:opacity-100"
        >
          <ChevronLeft className="size-4" />
        </button>
      )}
      {activeIndex < slides.length - 1 && (
        <button
          type="button"
          onClick={() => scrollToSlide(activeIndex + 1)}
          aria-label="Foto siguiente"
          className="absolute top-1/2 right-3 flex size-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white opacity-0 backdrop-blur-sm transition-opacity group-hover/gallery:opacity-100 hover:bg-black/60 focus-visible:opacity-100"
        >
          <ChevronRight className="size-4" />
        </button>
      )}

      <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center gap-1.5">
        {slides.map((_, i) => (
          <span
            key={i}
            className={cn(
              "size-1.5 rounded-full transition-colors",
              i === activeIndex ? "bg-white" : "bg-white/50",
            )}
          />
        ))}
      </div>
    </div>
  );
}

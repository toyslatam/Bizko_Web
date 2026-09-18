"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { Loader2, Package } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";
import { ProductDetailActions } from "@/components/store/product-detail-actions";
import { ProductImageGallery } from "@/components/store/product-image-gallery";
import { formatCurrencyCents, formatVariantPriceRange } from "@/lib/format";
import { UNIT_LABELS } from "@/lib/catalog";
import { formatQuantity } from "@/lib/inventory";
import type {
  PublicComboItem,
  PublicModifierGroup,
  PublicModifierOption,
  PublicProduct,
  PublicProductImage,
  PublicVariant,
  PublicVariantAttribute,
} from "@/types/database";

interface QuickViewData {
  variants: PublicVariant[];
  variantAttributes: PublicVariantAttribute[];
  modifierGroups: PublicModifierGroup[];
  modifierOptions: PublicModifierOption[];
  comboItems: PublicComboItem[];
}

export function ProductQuickView({
  slug,
  product,
  open,
  onOpenChange,
}: {
  slug: string;
  product: PublicProduct;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [data, setData] = React.useState<QuickViewData | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [galleryImages, setGalleryImages] = React.useState<PublicProductImage[]>([]);

  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setGalleryImages([]);

    async function loadGallery() {
      const supabase = createClient();
      const { data: galleryData } = await supabase.rpc("list_public_product_images", {
        p_product_id: product.id,
      });
      if (!cancelled) setGalleryImages((galleryData as PublicProductImage[]) ?? []);
    }

    loadGallery();
    return () => {
      cancelled = true;
    };
  }, [open, product.id]);

  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    // Reinicia el estado al abrir para un modal nuevo — no hay forma de derivar
    // esto sin un efecto porque depende del evento de apertura, no de props puras.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setData(null);

    async function load() {
      const supabase = createClient();

      if (product.has_variants) {
        const [{ data: variantsData }, { data: attributesData }] = await Promise.all([
          supabase.rpc("list_public_variants", { p_product_id: product.id }),
          supabase.rpc("list_public_variant_attributes", { p_product_id: product.id }),
        ]);
        if (cancelled) return;
        setData({
          variants: (variantsData as PublicVariant[]) ?? [],
          variantAttributes: (attributesData as PublicVariantAttribute[]) ?? [],
          modifierGroups: [],
          modifierOptions: [],
          comboItems: [],
        });
      } else {
        const [{ data: groupsData }, { data: optionsData }, { data: comboItemsData }] = await Promise.all([
          supabase.rpc("list_public_modifier_groups", { p_product_id: product.id }),
          supabase.rpc("list_public_modifier_options", { p_product_id: product.id }),
          supabase.rpc("list_public_combo_items", { p_product_id: product.id }),
        ]);
        if (cancelled) return;
        setData({
          variants: [],
          variantAttributes: [],
          modifierGroups: (groupsData as PublicModifierGroup[]) ?? [],
          modifierOptions: (optionsData as PublicModifierOption[]) ?? [],
          comboItems: (comboItemsData as PublicComboItem[]) ?? [],
        });
      }
      if (!cancelled) setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [open, product.id, product.has_variants]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100%-2rem)] gap-0 overflow-hidden p-0 sm:max-w-3xl">
        <DialogTitle className="sr-only">{product.name}</DialogTitle>
        <DialogDescription className="sr-only">
          {product.description || `Detalle de ${product.name}`}
        </DialogDescription>

        <div className="grid max-h-[85vh] grid-cols-1 overflow-y-auto sm:grid-cols-2 sm:overflow-visible">
          {/*
            Cuadrado en todos los tamaños: con `sm:aspect-auto sm:h-full` el
            contenedor se estiraba al alto de la columna de texto, quedaba alto y
            angosto, y `object-cover` recortaba el producto por los lados.
          */}
          <div className="relative aspect-square w-full shrink-0 self-start bg-muted">
            {galleryImages.length > 0 ? (
              <ProductImageGallery primaryImageUrl={product.image_url} images={galleryImages} />
            ) : product.image_url ? (
              <Image src={product.image_url} alt="" fill className="object-contain" sizes="500px" />
            ) : (
              <div className="flex size-full items-center justify-center">
                <Package className="size-12 text-muted-foreground" />
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3 overflow-y-auto p-5 sm:max-h-[85vh]">
            <div>
              <h2 className="font-heading text-lg font-semibold text-foreground">{product.name}</h2>
              <p className="mt-0.5 text-xl font-semibold text-brand">
                {product.has_variants ? (
                  data ? (
                    formatVariantPriceRange(data.variants)
                  ) : (
                    <span className="text-sm font-normal text-muted-foreground">Cargando precio...</span>
                  )
                ) : (
                  <>
                    {formatCurrencyCents(product.price_cents)}
                    <span className="text-sm font-normal text-muted-foreground"> / {UNIT_LABELS[product.unit]}</span>
                  </>
                )}
              </p>
            </div>

            {product.description && (
              <p className="text-sm text-muted-foreground">{product.description}</p>
            )}

            {product.track_inventory && (
              <p className="text-xs text-muted-foreground">
                {product.current_stock <= 0
                  ? "Agotado"
                  : `Disponible · ${formatQuantity(product.current_stock)} ${UNIT_LABELS[product.unit]}`}
              </p>
            )}

            {loading ? (
              <div className="flex flex-1 items-center justify-center py-8 text-muted-foreground">
                <Loader2 className="size-5 animate-spin" />
              </div>
            ) : data ? (
              <>
                {data.comboItems.length > 0 && (
                  <div className="rounded-lg bg-muted px-3 py-2 text-sm">
                    <p className="mb-1 font-medium text-foreground">Incluye:</p>
                    <ul className="list-inside list-disc space-y-0.5 text-muted-foreground">
                      {data.comboItems.map((item, i) => (
                        <li key={i}>
                          {formatQuantity(item.quantity)} {item.unit === "unidad" ? "" : `${UNIT_LABELS[item.unit]} `}
                          {item.component_name}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <ProductDetailActions
                  slug={slug}
                  product={product}
                  variants={data.variants}
                  variantAttributes={data.variantAttributes}
                  modifierGroups={data.modifierGroups}
                  modifierOptions={data.modifierOptions}
                />
              </>
            ) : null}

            <Link
              href={`/store/${slug}/producto/${product.id}`}
              className="mt-1 text-center text-xs font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            >
              Ver página completa
            </Link>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

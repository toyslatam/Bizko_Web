import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft, Package } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ProductDetailActions } from "@/components/store/product-detail-actions";
import { formatCurrencyCents } from "@/lib/format";
import { UNIT_LABELS } from "@/lib/catalog";
import { formatQuantity } from "@/lib/inventory";
import type {
  PublicCompany,
  PublicProduct,
  PublicVariant,
  PublicVariantAttribute,
  PublicModifierGroup,
  PublicModifierOption,
  PublicComboItem,
} from "@/types/database";

interface ProductPageProps {
  params: Promise<{ slug: string; id: string }>;
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { slug, id } = await params;
  const supabase = await createClient();

  const { data: companyData } = await supabase.rpc("get_public_company", { p_slug: slug }).maybeSingle();
  const company = companyData as PublicCompany | null;
  if (!company) return {};

  const { data: productsData } = await supabase.rpc("list_public_products", {
    p_company_id: company.id,
    p_category_id: null,
  });
  const product = ((productsData as PublicProduct[]) ?? []).find((p) => p.id === id);
  if (!product) return {};

  const title = `${product.name} · ${company.name}`;
  const description = product.description || `Compra ${product.name} en ${company.name}`;
  const image = product.image_url ?? company.banner_url ?? company.logo_url ?? "/files/app_icon.svg";

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [image],
    },
  };
}

export default async function PublicProductPage({ params }: ProductPageProps) {
  const { slug, id } = await params;
  const supabase = await createClient();

  const { data: companyData } = await supabase.rpc("get_public_company", { p_slug: slug }).maybeSingle();
  const company = companyData as PublicCompany | null;
  if (!company) notFound();

  const { data: productsData } = await supabase.rpc("list_public_products", {
    p_company_id: company.id,
    p_category_id: null,
  });
  const product = ((productsData as PublicProduct[]) ?? []).find((p) => p.id === id);
  if (!product) notFound();

  let variants: PublicVariant[] = [];
  let variantAttributes: PublicVariantAttribute[] = [];
  let modifierGroups: PublicModifierGroup[] = [];
  let modifierOptions: PublicModifierOption[] = [];
  let comboItems: PublicComboItem[] = [];

  if (product.has_variants) {
    const [{ data: variantsData }, { data: attributesData }] = await Promise.all([
      supabase.rpc("list_public_variants", { p_product_id: product.id }),
      supabase.rpc("list_public_variant_attributes", { p_product_id: product.id }),
    ]);
    variants = (variantsData as PublicVariant[]) ?? [];
    variantAttributes = (attributesData as PublicVariantAttribute[]) ?? [];
  } else {
    const [{ data: groupsData }, { data: optionsData }, { data: comboItemsData }] = await Promise.all([
      supabase.rpc("list_public_modifier_groups", { p_product_id: product.id }),
      supabase.rpc("list_public_modifier_options", { p_product_id: product.id }),
      supabase.rpc("list_public_combo_items", { p_product_id: product.id }),
    ]);
    modifierGroups = (groupsData as PublicModifierGroup[]) ?? [];
    modifierOptions = (optionsData as PublicModifierOption[]) ?? [];
    comboItems = (comboItemsData as PublicComboItem[]) ?? [];
  }

  return (
    <div>
      <Link
        href={`/store/${slug}`}
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Volver al catálogo
      </Link>

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="relative aspect-square w-full bg-muted">
          {product.image_url ? (
            <Image src={product.image_url} alt="" fill className="object-cover" sizes="600px" />
          ) : (
            <div className="flex size-full items-center justify-center">
              <Package className="size-12 text-muted-foreground" />
            </div>
          )}
        </div>

        <div className="space-y-3 p-4">
          <div>
            <h1 className="font-heading text-lg font-semibold text-foreground">{product.name}</h1>
            <p className="mt-0.5 text-xl font-semibold text-brand">
              {formatCurrencyCents(product.price_cents)}
              <span className="text-sm font-normal text-muted-foreground"> / {UNIT_LABELS[product.unit]}</span>
            </p>
          </div>

          {product.description && (
            <p className="text-sm text-muted-foreground">{product.description}</p>
          )}

          {comboItems.length > 0 && (
            <div className="rounded-lg bg-muted px-3 py-2 text-sm">
              <p className="mb-1 font-medium text-foreground">Incluye:</p>
              <ul className="list-inside list-disc space-y-0.5 text-muted-foreground">
                {comboItems.map((item, i) => (
                  <li key={i}>
                    {formatQuantity(item.quantity)} {item.unit === "unidad" ? "" : `${UNIT_LABELS[item.unit]} `}
                    {item.component_name}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {product.track_inventory && (
            <p className="text-xs text-muted-foreground">
              {product.current_stock <= 0
                ? "Agotado"
                : `Disponible · ${formatQuantity(product.current_stock)} ${UNIT_LABELS[product.unit]}`}
            </p>
          )}

          <ProductDetailActions
            slug={slug}
            product={product}
            variants={variants}
            variantAttributes={variantAttributes}
            modifierGroups={modifierGroups}
            modifierOptions={modifierOptions}
          />
        </div>
      </div>
    </div>
  );
}

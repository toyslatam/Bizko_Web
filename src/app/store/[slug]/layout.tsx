import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { MapPin, Phone, Clock } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { CartProvider } from "@/components/store/cart-context";
import { CartButton } from "@/components/store/cart-button";
import { ShareButton } from "@/components/store/share-button";
import { StickyCartBar } from "@/components/store/sticky-cart-bar";
import { getBusinessModule } from "@/modules/registry";
import type { PublicCompany } from "@/types/database";

export default async function StoreLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_public_company", { p_slug: slug }).maybeSingle();
  const company = data as PublicCompany | null;
  if (!company) notFound();

  const businessModule = getBusinessModule(company.business_type);
  const headerList = await headers();
  const host = headerList.get("host") ?? "";
  const protocol = headerList.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const shareUrl = `${protocol}://${host}/store/${company.slug}`;

  // Color de acento propio del negocio (Fase 15.1 §12) — solo sobreescribe
  // las variables CSS de marca dentro del catálogo público; el panel interno
  // de bizko nunca las hereda porque este layout no lo envuelve.
  const accentStyle = company.accent_color
    ? ({ "--brand": company.accent_color, "--primary": company.accent_color } as React.CSSProperties)
    : undefined;

  return (
    <CartProvider slug={company.slug}>
      <div className="min-h-dvh bg-muted/30" style={accentStyle}>
        <header className="bg-sidebar text-white">
          <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
            <Link href={`/store/${company.slug}`} className="flex items-center gap-2">
              {company.logo_url ? (
                <Image
                  src={company.logo_url}
                  alt=""
                  width={32}
                  height={32}
                  className="size-8 rounded-lg object-cover"
                />
              ) : (
                <Image src="/files/app_icon.svg" alt="" width={32} height={32} className="rounded-lg" />
              )}
              <span className="font-heading text-base font-semibold">{company.name}</span>
            </Link>
            <div className="flex items-center gap-1">
              <ShareButton title={`Compra en ${company.name}`} url={shareUrl} />
              <CartButton slug={company.slug} />
            </div>
          </div>

          <div className="mx-auto flex max-w-3xl flex-col items-center gap-1.5 px-4 pb-6 text-center">
            <span className="text-2xl">{businessModule.emoji}</span>
            {company.description && (
              <p className="max-w-md text-sm text-white/80">{company.description}</p>
            )}
            <div className="mt-1 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-white/70">
              {company.city && (
                <span className="flex items-center gap-1">
                  <MapPin className="size-3.5" /> {company.city}
                </span>
              )}
              {company.phone && (
                <span className="flex items-center gap-1">
                  <Phone className="size-3.5" /> {company.phone}
                </span>
              )}
              {company.business_hours && (
                <span className="flex items-center gap-1">
                  <Clock className="size-3.5" /> {company.business_hours}
                </span>
              )}
            </div>
          </div>
        </header>

        {company.banner_url && (
          <div className="mx-auto max-w-3xl px-4 pt-4">
            <div className="relative aspect-[3/1] w-full overflow-hidden rounded-xl bg-muted">
              <Image src={company.banner_url} alt="" fill className="object-cover" sizes="768px" priority />
            </div>
          </div>
        )}

        <main className="mx-auto max-w-3xl px-4 py-6 pb-28">{children}</main>

        <StickyCartBar slug={company.slug} />
      </div>
    </CartProvider>
  );
}

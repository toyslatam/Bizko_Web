import { redirect } from "next/navigation";
import { Images } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/lib/auth/session";
import { businessHasAgenda } from "@/lib/catalog";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { GalleryUploadSheet } from "@/components/galeria/gallery-upload-sheet";
import { GalleryGrid, type GalleryItemWithNames } from "@/components/galeria/gallery-grid";
import type { Professional, Service } from "@/types/database";

export default async function GaleriaPage() {
  const session = await getSessionContext();
  if (!session) redirect("/login");
  if (!session.activeCompany) redirect("/onboarding");
  if (!businessHasAgenda(session.activeCompany.business_type)) redirect("/dashboard");

  const supabase = await createClient();
  const companyId = session.activeCompany.id;

  const [{ data: galleryData }, { data: servicesData }, { data: professionalsData }] =
    await Promise.all([
      supabase
        .from("work_gallery")
        .select("id, image_url, description, service:services(name), professional:professionals(name)")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false }),
      supabase
        .from("services")
        .select("*")
        .eq("company_id", companyId)
        .eq("status", "active")
        .order("name"),
      supabase
        .from("professionals")
        .select("*")
        .eq("company_id", companyId)
        .eq("status", "active")
        .order("name"),
    ]);

  const items: GalleryItemWithNames[] = (galleryData ?? []).map((row) => {
    const r = row as unknown as {
      id: string;
      image_url: string;
      description: string | null;
      service: { name: string } | { name: string }[] | null;
      professional: { name: string } | { name: string }[] | null;
    };
    const service = Array.isArray(r.service) ? r.service[0] : r.service;
    const professional = Array.isArray(r.professional) ? r.professional[0] : r.professional;
    return {
      id: r.id,
      image_url: r.image_url,
      description: r.description,
      service_name: service?.name ?? null,
      professional_name: professional?.name ?? null,
    };
  });

  const services = (servicesData ?? []) as Service[];
  const professionals = (professionalsData ?? []) as Professional[];

  return (
    <div>
      <PageHeader
        title="Galería de trabajos"
        description="Muestra fotos de tus trabajos terminados."
        actions={
          <GalleryUploadSheet
            companyId={companyId}
            services={services}
            professionals={professionals}
          />
        }
      />

      {items.length > 0 ? (
        <GalleryGrid items={items} />
      ) : (
        <EmptyState
          icon={Images}
          title="Todavía no tienes fotos"
          description="Sube fotos de tus trabajos terminados para mostrarlas a tus clientes."
          action={
            <GalleryUploadSheet
              companyId={companyId}
              services={services}
              professionals={professionals}
            />
          }
        />
      )}
    </div>
  );
}

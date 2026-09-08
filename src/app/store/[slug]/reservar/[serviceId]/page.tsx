import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { BookingFlow } from "@/components/store/booking-flow";
import { businessHasAgenda } from "@/lib/catalog";
import type { PublicCompany, PublicProfessional, PublicService } from "@/types/database";

interface BookingPageProps {
  params: Promise<{ slug: string; serviceId: string }>;
}

export async function generateMetadata({ params }: BookingPageProps): Promise<Metadata> {
  const { slug, serviceId } = await params;
  const supabase = await createClient();

  const { data: companyData } = await supabase.rpc("get_public_company", { p_slug: slug }).maybeSingle();
  const company = companyData as PublicCompany | null;
  if (!company) return {};

  const { data: servicesData } = await supabase.rpc("list_public_services", { p_company_id: company.id });
  const service = ((servicesData as PublicService[]) ?? []).find((s) => s.id === serviceId);
  if (!service) return {};

  return {
    title: `Reservar ${service.name} · ${company.name}`,
    description: `Agenda tu cita de ${service.name} en ${company.name}.`,
  };
}

export default async function BookingPage({ params }: BookingPageProps) {
  const { slug, serviceId } = await params;
  const supabase = await createClient();

  const { data: companyData } = await supabase.rpc("get_public_company", { p_slug: slug }).maybeSingle();
  const company = companyData as PublicCompany | null;
  if (!company || !businessHasAgenda(company.business_type)) notFound();

  const { data: servicesData } = await supabase.rpc("list_public_services", { p_company_id: company.id });
  const service = ((servicesData as PublicService[]) ?? []).find((s) => s.id === serviceId);
  if (!service) notFound();

  const { data: professionalsData } = await supabase.rpc("list_public_professionals", {
    p_company_id: company.id,
    p_service_id: service.id,
  });
  const professionals = (professionalsData as PublicProfessional[]) ?? [];

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href={`/store/${slug}`}
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Volver al catálogo
      </Link>

      <BookingFlow slug={slug} service={service} initialProfessionals={professionals} />
    </div>
  );
}

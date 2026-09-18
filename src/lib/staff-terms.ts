import type { BusinessType } from "@/types/database";

/**
 * Cómo se llama la gente que atiende, según el rubro.
 *
 * En peluquería, taller, mascotas y lavadero son "profesionales": la cita se
 * agenda *con* alguien y el cliente suele elegir con quién. En "Varios" el
 * negocio puede no trabajar así —la cita depende del servicio y asignar a
 * alguien es opcional—, así que ahí se llaman "empleados".
 */
export interface StaffTerms {
  singular: string;
  plural: string;
  /** "Nuevo profesional" / "Nuevo empleado". */
  newLabel: string;
  /** Artículo + singular, para frases: "el profesional" / "el empleado". */
  theSingular: string;
}

const PROFESSIONAL: StaffTerms = {
  singular: "profesional",
  plural: "profesionales",
  newLabel: "Nuevo profesional",
  theSingular: "el profesional",
};

const EMPLOYEE: StaffTerms = {
  singular: "empleado",
  plural: "empleados",
  newLabel: "Nuevo empleado",
  theSingular: "el empleado",
};

export function staffTermsFor(businessType: BusinessType): StaffTerms {
  return businessType === "general" ? EMPLOYEE : PROFESSIONAL;
}

/** Con mayúscula inicial, para títulos y etiquetas. */
export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * En "Varios" la agenda se organiza por servicio y asignar a alguien es
 * opcional, así que se muestra una columna "Sin asignar" y la agenda funciona
 * aunque no haya nadie cargado. En los demás rubros la cita siempre va con un
 * profesional.
 */
export function agendaAllowsUnassigned(businessType: BusinessType): boolean {
  return businessType === "general";
}

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/lib/auth/session";
import { AUTOMATION_TEMPLATES } from "@/lib/automations";
import type { AutomationStatus } from "@/types/database";

type ActionResult = { ok: true } | { error: string };

export async function activateTemplateAction(templateKey: string): Promise<ActionResult> {
  const session = await getSessionContext();
  if (!session?.activeCompany) return { error: "No encontramos tu negocio activo." };

  const template = AUTOMATION_TEMPLATES.find((t) => t.key === templateKey);
  if (!template) return { error: "Esa plantilla no existe." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_automation", {
    p_company_id: session.activeCompany.id,
    p_name: template.name,
    p_trigger_type: template.trigger_type,
    p_condition: template.condition,
    p_action_type: template.action_type,
    p_action_config: template.action_config,
    p_template_key: template.key,
  });

  if (error) return { error: error.message };

  revalidatePath("/automatizaciones");
  return { ok: true };
}

export async function setAutomationStatusAction(
  id: string,
  status: AutomationStatus,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_automation_status", {
    p_automation_id: id,
    p_status: status,
  });

  if (error) return { error: error.message };

  revalidatePath("/automatizaciones");
  return { ok: true };
}

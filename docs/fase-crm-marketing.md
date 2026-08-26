# Fase — CRM, Marketing, IA y generación de contenido

Mismo principio que `docs/fase-13-ia-automatizaciones.md`: todo lo que no
depende de un proveedor externo o de un VPS quedó **completo y funcional**.
Todo lo que sí depende de una integración externa quedó como **estructura +
UI preparada**, sin simular tráfico ni resultados falsos.

## Completo y funcional hoy

- **CRM**: leads, pipeline configurable por empresa (`crm_pipeline_stages`),
  historial de etapas, tareas, notas, etiquetas — todo con RLS multi-tenant.
- **Conversión LEAD → CLIENTE**: `convert_lead_to_customer()` crea un
  `customers` real (nunca duplica) y deja `customers.converted_from_lead_id`
  + `customers.source` para la trazabilidad LEAD → CLIENTE → PEDIDO → VENTA
  (pedidos/ventas ya se leen por `customer_id`, sin tablas nuevas).
- **Vista 360° del cliente**: `get_customer_crm_summary()`.
- **Marketing**: campañas con flujo de aprobación (`set_campaign_status()`,
  BORRADOR → REVISIÓN → APROBADA → PROGRAMADA → PUBLICADA → FINALIZADA, sin
  saltos), calendario (se lee de `marketing_campaigns.scheduled_at`),
  segmentos con 5 tipos de condición reales (`count_segment_customers()`),
  créditos de marketing con ledger (`marketing_credits`/`marketing_credit_usage`,
  costo por acción configurable en `marketing_credit_costs`, solo editable
  por Super Admin).
- **Atribución**: `report_attribution_by_channel()` — de qué canal vino cada
  cliente y cuánto ha generado en ventas.
- **Plan Marketing**: no se hardcodeó ningún plan nuevo — el feature `marketing`
  y el límite `max_marketing_credits_month` ya existen en el catálogo; un
  Super Admin crea el plan real desde `/admin/planes` (Fase 11) y decide ahí
  el precio, el feature set y el número de créditos mensuales.

## Estructura lista, sin integración real todavía

- **Canales** (`crm_channels`): WhatsApp/Instagram/Facebook/LinkedIn/Email
  nacen siempre en `not_connected`. Conectar cada uno requiere sus API
  oficiales (Meta Business API, LinkedIn API, proveedor de email) y credenciales
  por empresa — no existen todavía.
- **Bandeja de entrada** (`crm_conversations`/`crm_messages`): el esquema y la
  UI están listos para mostrar conversaciones reales; hoy no hay ningún
  webhook que las escriba (se puede registrar una conversación manualmente,
  ej. una llamada telefónica, mientras tanto).
- **Generación de contenido con IA** (§10): `marketing_campaign_content` ya
  guarda contenido con `generated_by: 'manual' | 'ai'`. Hoy solo se puede
  escribir a mano — generar con IA necesita el mismo proveedor de IA que
  falta desde la Fase 13 (`/asistente-ia`).
- **Generación de imágenes/video** (§11/§12/§13): no se construyó un motor
  propio (explícitamente fuera de alcance). Falta conectar un proveedor
  externo vía API (ej. un servicio de generación de imágenes/video) antes de
  poder ofrecer esto — el costo en créditos ya está modelado
  (`marketing_credit_costs`: imagen 5, video 20) para cuando se conecte.
- **Clasificación de leads con IA** (§6): requiere el mismo proveedor de IA
  pendiente. La UI puede mostrarse pero sin sugerencias reales hasta entonces.
- **n8n para marketing** (§16): reutiliza la infraestructura de automatizaciones
  de la Fase 13 (`automations`, `automation_webhook_secrets`) — sigue sin VPS.

## Qué falta para producción

1. VPS + instancia n8n (mismo pendiente de la Fase 13).
2. Credenciales oficiales por canal (Meta Business API para WhatsApp/Instagram/
   Facebook, LinkedIn API, proveedor de email transaccional).
3. Proveedor de IA para texto (mismo de la Fase 13) + un proveedor de
   generación de imágenes/video vía API.
4. Crear el "Plan Marketing" desde `/admin/planes` con precio y créditos reales.

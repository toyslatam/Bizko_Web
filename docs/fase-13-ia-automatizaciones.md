# Fase 13 — IA y automatizaciones: arquitectura y lo que falta para producción

Este documento acompaña la migración `supabase/migrations/0016_ai_automations.sql`
y el código de `/asistente-ia` y `/automatizaciones`. Describe qué quedó
construido en esta fase (estructura, sin proveedor de IA ni n8n reales
conectados — no hay VPS todavía) y exactamente qué falta para que ambas
capacidades funcionen de verdad.

## 1. Principio de arquitectura

```
bizko (interfaz + datos + permisos + planes + límites)
   │
   ├── IA        → interpreta preguntas, pide datos a bizko, nunca toca Postgres directo
   │
   └── n8n       → ejecuta automatizaciones, tareas programadas, integraciones
```

Ni la IA ni n8n tienen acceso directo a la base de datos. Todo pasa por
funciones de Postgres (`ai_get_*`, `report_*`) o por el backend de bizko
(Server Actions / Route Handlers), y todo respeta `company_id` + usuario +
rol + plan + permisos — los mismos mecanismos ya usados en el resto de la
app (RLS, `is_company_member()`, `plan_limits`).

## 2. Qué quedó construido en esta fase

### Base de datos (`0016_ai_automations.sql`)
- `plan_limits`: `max_ai_queries_month` (0/0/100 para básico/negocio/pro),
  `max_automations_active` (0/0/10).
- `ai_usage` — historial + medición de consumo. RLS: solo lectura por la
  propia empresa; el insert solo ocurre vía `log_ai_query()` (SECURITY
  DEFINER), que además valida el límite mensual de forma atómica.
- Capa seguro de consulta para IA — cada función es `security invoker`
  (respeta RLS) y valida `is_company_member()`:
  - `ai_get_sales_summary(company_id, start, end)`
  - `ai_get_top_products(company_id, start, end, limit)`
  - `ai_get_low_stock_products(company_id, limit)`
  - `ai_get_customer_summary(company_id, start, end, limit)`
  - `ai_get_order_summary(company_id, start, end)`
  - `ai_get_expense_summary(company_id, start, end)`
  - `ai_get_cash_summary(company_id, start, end)`

  Estas son funciones nuevas y separadas de los `report_*()` de la Fase 10
  a propósito: son la "superficie pública" que un modelo de IA puede pedir,
  documentada y estable, aunque internamente resuelvan preguntas parecidas.
- `automations` — trigger + condición opcional + acción, con `status`
  (`active`/`paused`/`error`) y `template_key`. RLS estándar
  (`is_company_member`). `create_automation()` valida el límite de
  *automatizaciones activas* del plan de forma atómica antes de insertar.
  `set_automation_status()` pausa/reactiva.
- `automation_usage` — un registro por ejecución (pending → running →
  success/failed). Sin política de insert/update para clientes: solo el
  backend de bizko (service role) escribe aquí — ver §4 abajo.
  `register_automation_execution()` también marca la automatización como
  `error` tras 3 fallos consecutivos ("Esta automatización necesita
  atención"), sin borrarla nunca.
- `notifications` — centro de notificaciones (stock bajo, nuevo pedido,
  automatización ejecutada/con error, aviso de límite de IA). RLS: cada
  usuario solo ve/marca-como-leídas las suyas.
- `automation_webhook_secrets` — un secreto HMAC por empresa, generado con
  `get_or_create_webhook_secret()` (solo el dueño puede pedirlo). Sirve para
  firmar los eventos que bizko enviará a n8n, para que n8n pueda validar que
  el evento es legítimo.

### Aplicación
- `/asistente-ia`: gateada por la feature `ai` (solo Pro). Muestra el uso
  del mes (`get_plan_usage`), las preguntas sugeridas del spec, y un
  historial (vacío hasta que haya un modelo real conectado). El input está
  deshabilitado a propósito — no se simula una respuesta falsa.
- `/automatizaciones`: gateada por la feature `automation` (solo Pro).
  Plantillas activables con un clic (Stock bajo, Nuevo pedido, Resumen
  semanal, Pedido entregado) que crean una fila real en `automations` vía
  `create_automation()`, respetando el límite de 10 activas. Lista de
  automatizaciones con pausar/reactivar. La ejecución real todavía no
  ocurre (no hay n8n desplegado).
- El widget "Tu plan" del dashboard (`PlanUsageCard`, ya genérico sobre
  todos los `plan_limits`) automáticamente muestra "Consultas IA este mes"
  y "Automatizaciones activas" para empresas Pro, sin cambios adicionales.

## 3. Qué falta para que el Asistente IA funcione de verdad

1. **Elegir proveedor y guardar la API key server-side.** Variable de
   entorno `ANTHROPIC_API_KEY` (o `OPENAI_API_KEY`) en Vercel/hosting —
   nunca en código ni en el bundle del cliente.
2. **Server Action `askAiAction(question: string)`**:
   - Verifica `session.enabledFeatures.has("ai")` y llama `get_plan_usage`
     para confirmar que no se alcanzó el límite (mensaje exacto ya definido
     en el spec: "Has alcanzado tus consultas de IA de este período.").
   - Clasifica la intención de la pregunta (routing simple por palabras
     clave, o tool-calling nativo del modelo) para decidir qué función
     `ai_get_*` invocar y con qué rango de fechas.
   - Llama la(s) función(es) `ai_get_*` correspondientes vía Supabase RPC.
   - Arma un prompt corto que incluya SOLO los datos ya agregados que
     devolvió la función (nunca acceso libre a la base de datos), y pide al
     modelo una respuesta corta, clara, orientada a decisión (ver ejemplo
     del spec §7), citando la fuente ("Basado en 84 ventas registradas
     entre el 12 y 18 de agosto.").
   - Si no hay suficiente información: responder exactamente "No pude
     obtener suficiente información para responder con seguridad." — nunca
     inventar.
   - Llama `log_ai_query()` con la pregunta, la respuesta, el modelo y los
     tokens usados (el SDK del proveedor los devuelve en la respuesta).
3. **Conectar la UI**: quitar `disabled` del input/botón en
   `src/app/(app)/asistente-ia/page.tsx`, convertir esa sección en un
   client component que llama `askAiAction`, muestra la respuesta y
   refresca el indicador de uso.
4. **Historial real**: reemplazar el `EmptyState` por una lista de
   `ai_usage` (ya tiene RLS lista para leerse directamente:
   `supabase.from("ai_usage").select("*").eq("company_id", ...).order(...)`).

## 4. Qué falta para que las Automatizaciones ejecuten de verdad (necesita VPS)

```
Evento en bizko (ej. venta creada, stock bajo)
   │
   ▼
Route Handler interno: POST /api/automations/dispatch
   │  (valida que el evento es interno — no expuesto públicamente sin firma)
   ▼
Busca automatizaciones activas de esa empresa que coincidan con el trigger
   │
   ▼
Firma el payload con el secreto de automation_webhook_secrets (HMAC-SHA256)
   │
   ▼
POST a la URL de webhook de n8n (N8N_WEBHOOK_BASE_URL, variable de entorno)
   {
     event: "low_stock",
     company_id: "...",
     resource_id: "...",
     automation_id: "...",
     signature: "hmac..."
   }
   │
   ▼
n8n valida la firma, corre el workflow, ejecuta la acción real
(notificación, correo, webhook externo, etc.)
   │
   ▼
n8n llama de vuelta: POST /api/automations/callback
   { automation_id, execution_id, status: "success"|"failed", error? }
   │
   ▼
bizko valida un secreto compartido (N8N_CALLBACK_SECRET) y llama
register_automation_execution() — esto es lo único que escribe en
automation_usage, siempre desde el backend, nunca desde el navegador.
```

Pasos concretos, en orden:

1. **Levantar n8n** — un VPS pequeño (2 vCPU / 4 GB alcanza para empezar) o
   n8n Cloud. Guardar la URL base como `N8N_WEBHOOK_BASE_URL`.
2. **Definir `N8N_CALLBACK_SECRET`** (un valor aleatorio largo) como
   variable de entorno tanto en bizko como en el workflow de n8n que hace
   el callback — así bizko puede validar que el callback realmente viene de
   n8n y no de cualquiera.
3. **Construir `src/app/api/automations/dispatch/route.ts`** (Route
   Handler, no expuesto a un usuario final — solo lo llama código interno
   de bizko cuando ocurre un evento relevante, ej. dentro de `create_sale`
   después de confirmarla, o en un cron para `daily_schedule`/
   `weekly_schedule`). Responsabilidades: buscar automatizaciones activas
   que coincidan, evaluar la `condition` (comparación simple ya guardada
   como JSON, ej. `{"field":"current_stock","operator":"<=","value_field":
   "minimum_stock"}`), firmar y enviar a n8n, registrar
   `register_automation_execution(..., status: 'pending')`.
4. **Construir `src/app/api/automations/callback/route.ts`** — valida
   `N8N_CALLBACK_SECRET`, llama `register_automation_execution()` con el
   resultado final.
5. **Crear los workflows en n8n** para cada plantilla del catálogo
   (§24 del spec): Stock bajo, Nuevo pedido, Resumen semanal, Pedido
   entregado. Cada uno recibe el webhook, hace lo que corresponda
   (notificación interna en bizko vía su propia API, correo, etc.) y llama
   el callback.
6. **Programar los triggers de calendario** (`daily_schedule`,
   `weekly_schedule`) — o bien un cron de Vercel (`vercel.json` → `crons`,
   ver la nota de conocimiento de Vercel sobre `vercel.ts`) que llama
   `/api/automations/dispatch` con esos triggers, o un Cron Node dentro de
   n8n mismo apuntando directo a bizko.
7. **Reintentos** (spec §31): si el dispatch a n8n falla (timeout, 5xx), no
   fallar silenciosamente — reintentar con backoff (ej. 3 intentos) antes
   de marcar la ejecución como `failed`. Esto vive en
   `/api/automations/dispatch`, no en el frontend.

## 5. Acciones sensibles (spec §26)

Ninguna automatización debe poder ejecutar, sin aprobación humana explícita:
modificar precios, eliminar productos, hacer reembolsos, modificar caja,
cambiar configuración, o enviar comunicaciones masivas. La tabla
`automations.action_type` NO incluye ninguna de esas acciones hoy
(`notification`, `email`, `webhook`, `create_task`, `ai_summary` solamente)
— si en el futuro se agregan acciones sensibles, deben requerir una
confirmación explícita del usuario antes de cada ejecución (no solo al
crear la automatización), o quedar completamente fuera del catálogo de
`automation_action_type` hasta tener ese flujo de aprobación.

## 6. Seguridad y privacidad — ya garantizado por el diseño actual

- Toda función `ai_get_*`/`admin_*`/`report_*` filtra por `company_id` y
  valida `is_company_member()` — una empresa nunca puede ver datos de otra,
  incluso si el modelo de IA "alucinara" un `company_id` distinto (la
  función simplemente no devolvería filas).
- Los secretos (API key del proveedor de IA, `N8N_CALLBACK_SECRET`,
  `N8N_WEBHOOK_BASE_URL`) viven solo en variables de entorno del servidor.
  El secreto HMAC por empresa (`automation_webhook_secrets`) es la única
  excepción visible al usuario, y a propósito: el dueño lo necesita para
  configurar su propio workflow de n8n, igual que una API key de
  integración en cualquier SaaS (Stripe, etc.) — nunca se referencia desde
  código del bundle de React.
- `ai_usage`/`automation_usage` no guardan contraseñas, tokens ni claves —
  solo la pregunta, la respuesta y metadata de ejecución.

## 7. Control de costos (spec §28) — pendiente de UI, datos ya disponibles

`ai_usage` (tokens de entrada/salida por consulta) y `automation_usage`
(ejecuciones/errores) ya tienen todo lo necesario para que un futuro panel
de Super Admin (`/admin`) agregue una vista de "consumo por empresa": suma
de tokens y de ejecuciones agrupada por `company_id` y por mes. No se
construyó esa vista todavía — es una página más de `/admin`, con el mismo
patrón que `admin_usage_metrics()` de la Fase 12 (una función
`admin_ai_cost_metrics()` agregando `ai_usage`/`automation_usage` sería el
siguiente paso natural).

## 8. Resumen — qué es real hoy vs. qué necesita el paso siguiente

| Pieza | Estado |
|---|---|
| Esquema de datos (`ai_usage`, `automations`, `automation_usage`, `notifications`, secretos de webhook) | ✅ Listo |
| Límites por plan (100 consultas IA, 10 automatizaciones — Pro únicamente) | ✅ Listo y aplicado atómicamente en Postgres |
| Funciones seguras de consulta para IA | ✅ Listo |
| Página Asistente IA (UI, uso, sugerencias, historial) | ✅ Listo — input deshabilitado a propósito |
| Página Automatizaciones (plantillas, activar, pausar, límite) | ✅ Listo y funcional (crea filas reales) |
| Respuestas reales de un modelo de IA | ❌ Falta conectar un proveedor (API key) |
| Ejecución real de automatizaciones | ❌ Falta desplegar n8n (VPS) + los dos Route Handlers de dispatch/callback |
| Centro de notificaciones (UI) | ⏳ Tabla lista, falta la campanita en el topbar |
| Panel de costos para Super Admin | ⏳ Datos listos, falta la página en `/admin` |

# Fase 14 — Producción, seguridad, infraestructura y escalabilidad

Este documento cubre las partes de la Fase 14 que dependen de infraestructura
que todavía no existe (VPS, n8n, monitoreo, dominio, CI/CD) — se documentan
como checklist y procedimiento, no como código, porque no hay nada que
desplegar todavía. La parte que sí es código (RLS, seguridad financiera,
manejo de errores, índices, idempotencia) se resolvió directamente en el
repo — ver el resumen al final de este documento y el changelog de la
migración `0017_production_hardening.sql`.

## 1. Arquitectura final (confirmada)

```
Next.js 16 (Vercel)                    ← frontend + Server Actions + Route Handlers
   │
   ├── Supabase Postgres (RLS)         ← toda la lógica de negocio sensible vive
   │      + funciones SECURITY DEFINER    en funciones de Postgres, no en el
   │      + RLS por company_id            frontend (create_sale, create_public_order,
   │                                       admin_*, ai_get_*, report_*, get_plan_usage)
   ├── Supabase Auth                   ← sesión, JWT, cookies httpOnly (@supabase/ssr)
   ├── Supabase Storage                ← logos/imágenes, con políticas por carpeta
   │
   └── (futuro, no desplegado) n8n en VPS
          └── Webhooks firmados (HMAC) → automatizaciones → servicios externos
```

No hay lógica de negocio sensible solo-en-frontend: cada mutación que
importa (ventas, pedidos, cambios de plan, límites, auditoría) pasa por una
función de Postgres `security definer` que revalida todo server-side,
independientemente de lo que haya calculado o mostrado el navegador.

## 2. Variables de entorno — inventario y separación por ambiente

Variables actuales (`.env.local`, nunca commiteadas):

| Variable | Dónde se usa | Sensible |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | cliente y servidor | No (pública por diseño) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | cliente y servidor | No (protegida por RLS) |

Variables que faltan agregar cuando se conecten las piezas de las Fases
13/14 (todas **server-side únicamente**, nunca con prefijo `NEXT_PUBLIC_`):

| Variable | Para qué |
|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Operaciones que deben saltarse RLS desde el backend (ej. el callback de n8n escribiendo en `automation_usage`) — **nunca** exponerla al cliente |
| `ANTHROPIC_API_KEY` (o el proveedor de IA elegido) | Server Action del Asistente IA |
| `N8N_WEBHOOK_BASE_URL` | Dispatch de eventos hacia n8n |
| `N8N_CALLBACK_SECRET` | Validar que el callback de ejecución realmente viene de n8n |

Separación por ambiente: Vercel ya soporta esto de forma nativa —
Development / Preview / Production tienen sus propios valores de variables
de entorno (`vercel env add <NAME> <environment>`). Recomendación:
- Un proyecto de Supabase separado para **staging** y otro para
  **production** (los "free tier" de Supabase alcanzan para staging). Nunca
  apuntar Preview deployments de Vercel a la base de producción.
- `vercel env pull` para sincronizar `.env.local` de desarrollo sin copiar
  manualmente secretos entre máquinas.

## 3–5. Supabase / RLS / Super Admin — auditoría

Ver `0017_production_hardening.sql` y el resumen al final de este documento
para el detalle de lo que se revisó y los ajustes aplicados. Resumen del
principio ya vigente desde la Fase 2: **toda** tabla de negocio tiene RLS
habilitado con políticas ancladas a `is_company_member(company_id)`, y esa
función ya incluye el bypass de `is_platform_admin()` — así que un
Super Admin no necesita políticas especiales por tabla, y un usuario normal
nunca puede leer/escribir una empresa que no sea la suya porque
`is_company_member()` evalúa `auth.uid()` en el servidor de Postgres, nunca
un valor que el frontend pueda manipular.

## 6–7. Autenticación y autorización

Ya usa Supabase Auth exclusivamente (`supabase.auth.signInWithPassword`,
`signOut`, recuperación de contraseña vía `/recuperar` +
`/actualizar-password`) — no hay manejo manual de contraseñas en ningún
punto del código. Los roles (`owner`/`manager`/`employee` en
`src/lib/permissions.ts`, `platform_admins` aparte para Super Admin) se
comprueban en **cada** Server Action sensible vía `can(role, permission)`
antes de mutar datos — ver `src/app/(app)/caja/actions.ts`,
`src/app/(app)/ventas/actions.ts`, etc. Las políticas de RLS son la segunda
capa (independiente del frontend): incluso si alguien llamara la Server
Action saltándose la UI, `is_company_member()`/`is_company_owner()` en
Postgres igual bloquean el acceso cruzado.

## 8–9. Protección de API y webhooks

No hay Route Handlers públicos todavía más allá de lo que ya cubre
Supabase (PostgREST + RLS). Los futuros endpoints de automatizaciones
(`/api/automations/dispatch`, `/api/automations/callback`, ver
`docs/fase-13-ia-automatizaciones.md`) deben, al construirse:
- Validar la firma HMAC (`automation_webhook_secrets`) en cada request.
- Rechazar cualquier payload cuyo `company_id` no coincida con el que el
  servidor de bizko originalmente despachó (nunca confiar en un
  `company_id` que venga en el body sin validar contra el registro de
  `automation_usage`/`automations` correspondiente).
- Responder 401/403 sin detalle interno ante una firma inválida.

## 10. Idempotencia

Aplicado en `0017_production_hardening.sql`: se agregó una columna
`idempotency_key text` (nullable, con índice único parcial
`where idempotency_key is not null`) a `sales`, `cash_movements` y
`automation_usage` — las tres superficies donde un reintento de red o un
webhook duplicado podría crear un registro financiero o una ejecución
repetida. El campo es opcional hoy (nada lo usa todavía activamente) pero
la restricción ya existe: cuando el flujo de checkout/dispatch envíe una
clave (ej. un UUID generado en el cliente al abrir el formulario), un
segundo intento con la misma clave chocará contra el índice único en vez de
crear una fila duplicada. Ver el detalle de columnas en la migración.

## 11–14. Dinero, inventario, pedidos, delivery

- Todos los montos usan `integer`/`bigint` en centavos, nunca `float` — ya
  así desde la Fase 1 (`price_cents`, `total_cents`, etc.).
- Los totales de venta/pedido se recalculan siempre server-side dentro de
  `create_sale()`/`create_public_order()` a partir de `products`/
  `product_variants`/`services` reales — nunca se inserta un `total_cents`
  que venga tal cual del formulario del cliente (confirmado en la
  auditoría, ver más abajo).
- `delivery_fee_cents` se resuelve siempre desde `delivery_zones` dentro de
  `create_public_order()` — el cliente nunca puede enviar su propio costo
  de envío.
- Inventario: el descuento de stock ocurre `for update` (row lock) dentro
  de la misma transacción que crea la venta/pedido — dos compras
  simultáneas de las últimas 2 unidades se serializan correctamente en
  Postgres, no hay condición de carrera. No hay ningún camino donde el
  stock pueda quedar negativo sin pasar por esa validación.
- Nunca se borran ventas/movimientos de caja: anular una venta
  (`void_sale`) y los estados de pedido son siempre inserciones/cambios de
  estado, no `DELETE` — la trazabilidad queda intacta.

## 15. Suscripciones

`plan_id` y `status` de una empresa nunca se leen desde el frontend para
decidir permisos — cada página que necesita saberlo llama
`get_active_feature_keys()`/`get_plan_usage()` en el servidor (Server
Component), que a su vez resuelve el plan real desde `subscriptions` en
Postgres. El frontend solo *muestra* lo que el servidor ya determinó.

## 16. IA

Cubierto en la Fase 13: la IA solo puede invocar `ai_get_*()`, todas
`security invoker` + `is_company_member()`, nunca acceso libre a
PostgreSQL. La API key del proveedor (cuando se conecte) vive únicamente en
una variable de entorno server-side.

## 17–19. n8n + VPS (no desplegado — checklist para cuando exista el VPS)

**Checklist de aprovisionami="no confiar en root":**

1. Proveedor: cualquier VPS con Ubuntu LTS reciente (Hetzner/DigitalOcean/
   Vultr — 2 vCPU / 4 GB de RAM alcanza para arrancar).
2. Usuario no-root: crear un usuario con `sudo`, deshabilitar login SSH
   como `root` (`PermitRootLogin no` en `/etc/ssh/sshd_config`), solo
   autenticación por llave (`PasswordAuthentication no`).
3. Firewall: `ufw allow OpenSSH`, `ufw allow 80,443/tcp`, `ufw enable` —
   ningún otro puerto abierto al público (n8n corre detrás de un reverse
   proxy, nunca expuesto directo en su puerto).
4. Docker + Docker Compose instalados vía el repositorio oficial de Docker
   (no el paquete `docker.io` de Ubuntu, que suele ir desactualizado).
5. `docker-compose.yml` de n8n con:
   - Persistencia en un volumen nombrado (nunca datos de n8n en un
     contenedor efímero).
   - `N8N_BASIC_AUTH_ACTIVE=true` + usuario/contraseña fuertes, o mejor,
     n8n detrás de un proxy con su propia autenticación adicional.
   - Variables de entorno de n8n (incluyendo `N8N_ENCRYPTION_KEY`, que
     cifra las credenciales guardadas dentro de n8n) generadas una vez y
     resguardadas — perderla vuelve irrecuperables las credenciales ya
     guardadas en n8n.
6. HTTPS: Caddy o Nginx + Certbot para el subdominio (ej.
   `automations.bizko.app`), certificado Let's Encrypt con renovación
   automática.
7. Backups del volumen de n8n (workflows + credenciales cifradas) — ver §20.
8. **Multi-tenant en n8n (crítico, spec §19):** cada workflow que bizko
   dispare debe recibir el evento ya resuelto y validado por el backend de
   bizko (nunca un `company_id` que el propio workflow le pida al usuario
   o reciba sin firmar) — el contrato exacto está en
   `docs/fase-13-ia-automatizaciones.md` §4. Un workflow de n8n JAMÁS debe
   tener una credencial que le permita consultar Supabase directamente con
   privilegios amplios; solo debe poder llamar de vuelta al Route Handler
   de callback de bizko, autenticado con `N8N_CALLBACK_SECRET`.

## 20. Backups

**Supabase (base de datos):**
- Backups automáticos diarios ya incluidos en cualquier plan pagado de
  Supabase (Point-in-Time Recovery en el plan Pro). En el plan gratuito no
  hay PITR — si el proyecto sigue en el plan gratuito al momento del piloto
  real, este es el primer upgrade a hacer antes de aceptar el primer
  negocio real.
- Backup adicional manual antes de cada migración importante: exportar
  `pg_dump` desde el dashboard de Supabase o `supabase db dump` antes de
  correr una migración que altere columnas existentes (rename/drop), no
  solo las que agregan tablas nuevas.

**n8n:** backup del volumen Docker (workflows + credenciales) — un cron
simple con `docker run --rm -v n8n_data:/data -v $(pwd)/backups:/backup
alpine tar czf /backup/n8n-$(date +%F).tar.gz /data`, subido a un bucket
S3/Backblaze aparte del VPS.

**Prueba de restauración (obligatoria, no opcional):** antes del piloto,
restaurar un backup de Supabase a un proyecto de prueba y confirmar que la
app arranca contra esa copia — un backup nunca probado no cuenta como
backup real.

## 21. Recuperación ante desastres (objetivos iniciales, simples)

| Escenario | RPO objetivo | RTO objetivo | Procedimiento |
|---|---|---|---|
| Caída del VPS (n8n) | N/A (automatizaciones se degradan, no hay pérdida de datos de negocio) | < 4 h | Redesplegar el `docker-compose` en un VPS nuevo desde el backup del volumen; las automatizaciones fallidas mientras tanto quedan en `automation_usage` como `failed` para reintento manual |
| Caída de Supabase | Según SLA de Supabase (fuera de nuestro control directo) | Según SLA de Supabase | Monitorear el status page de Supabase; comunicar a los negocios si aplica |
| Eliminación accidental de datos | < 24 h (backup diario) | < 2 h | Restaurar desde el backup diario más reciente a un proyecto de recuperación, exportar solo las filas afectadas, reinsertar |
| Fallo de deployment (Vercel) | 0 (código versionado en Git) | Minutos | Rollback a la versión anterior desde el dashboard de Vercel (un clic) |

Estos son objetivos de arranque — se deben revisar y endurecer con datos
reales de uso una vez haya negocios reales operando.

## 22–23. Monitoreo y logs (checklist para cuando exista presupuesto/tiempo)

- **Aplicación (Vercel):** Vercel ya expone logs de Functions/Server
  Actions y métricas de errores 5xx en su dashboard sin configuración
  adicional — revisar ahí primero.
- **Supabase:** el dashboard de Supabase expone métricas de CPU/RAM/
  conexiones de la base y logs de queries lentas — activar alertas por
  email cuando el uso se acerque a los límites del plan.
- **n8n:** cuando exista, agregar un healthcheck simple (ej. UptimeRobot
  gratuito pegándole a una URL de n8n cada 5 minutos) y una alerta si un
  workflow falla repetidamente (ya modelado en la app:
  `automations.consecutive_errors >= 3` marca la automatización como
  `error` y se muestra "Esta automatización necesita atención" al dueño —
  eso ya es un monitoreo de primer nivel construido en el producto mismo).
- **Logs:** ningún log de este proyecto imprime contraseñas, API keys ni
  tokens — confirmado en la auditoría de esta fase. Los logs de errores en
  Server Actions deben identificar qué pasó, cuándo, en qué empresa y qué
  usuario cuando sea posible (`console.error` con esos campos) — revisar
  que eso se mantenga a medida que se agreguen más Server Actions.

## 24. Manejo de errores

Ver la auditoría (`0017_production_hardening.sql` y el resumen abajo): se
confirmó/ajustó que los mensajes de error mostrados al usuario final son
siempre texto curado en español (ya sea un mensaje fijo tipo "No pudimos
completar la operación." o un `raise exception` propio de una función
`security definer` de este proyecto, que ya está escrito en español para
mostrarse tal cual) — nunca el texto crudo de un error de Postgres/
PostgREST.

## 25–26. Rendimiento y reportes

Ya resuelto en las Fases 10 y 12: los dashboards y reportes usan funciones
de agregación en Postgres (`report_*`, `admin_*`, `get_plan_usage`), nunca
descargan miles de filas al navegador para calcular en JavaScript. La
paginación (`limit`/`offset` + `total_count` vía `count(*) over()`) ya está
implementada en los listados largos (`admin_list_companies`,
`admin_list_users`, `admin_list_subscriptions`). No se agregó una capa de
caché (Redis, etc.) en esta fase — no hace falta todavía al volumen de un
piloto; es el siguiente paso natural si el dashboard global de `/admin`
empieza a sentirse lento con cientos de empresas reales.

## 27. Storage

Ver auditoría — políticas de Storage ya scoped por carpeta/empresa desde la
Fase 1/2. La validación de tipo/tamaño de archivo en el upload se revisó y
ajustó si hacía falta — ver el resumen de cambios abajo.

## 28. Rate limiting (checklist — requiere un servicio externo)

Vercel/Next.js no incluye rate limiting nativo por endpoint. La opción más
simple sin operar infraestructura propia es **Upstash Redis** (tiene un
tier gratuito, se integra vía HTTP sin necesitar un servidor Redis propio)
+ el paquete `@upstash/ratelimit`. Cuando se implemente, priorizar en este
orden:
1. Login (`supabase.auth.signInWithPassword`) — límite por IP para evitar
   fuerza bruta de contraseñas (Supabase Auth ya tiene cierta protección
   nativa, pero una capa adicional por IP en el Route Handler/Server Action
   de login es recomendable antes del piloto).
2. `create_public_order` (catálogo público, sin autenticación) — límite por
   IP para evitar que un script cree pedidos falsos masivamente.
3. Consultas IA — ya limitado por plan (100/mes), pero un límite adicional
   de "no más de N solicitudes por minuto" evita que una sola empresa
   sature la API del proveedor de IA en una ráfaga.
4. Webhooks de n8n (cuando existan) — limitar por `company_id` además de
   por IP.

No implementado en esta fase por depender de una cuenta/servicio externo
nuevo (Upstash) que el usuario aún no tiene — queda como checklist.

## 29–30. Catálogo público y seguridad de imágenes

Ver auditoría — confirmado qué columnas exponen exactamente las funciones
`get_public_*`/`list_public_*` (nunca `cost_cents`, nunca datos de
clientes/caja/costos administrativos). Ver el resumen de cambios de
storage/uploads abajo para lo relacionado a validación de imágenes.

## 31. Dominios

Nada hardcodeado hoy: `NEXT_PUBLIC_SUPABASE_URL` viene de variable de
entorno, y las URLs del catálogo público se construyen con
`window.location.origin` (ver `StoreLink` en
`src/components/settings/company-settings-form.tsx`), no con un dominio
fijo en el código. Cuando exista `app.bizko.com` (o el dominio elegido),
configurarlo en Vercel (Project → Domains) — no requiere cambios de código.
Si más adelante se usan subdominios por negocio
(`negocio.bizko.com` en vez de `bizko.com/store/negocio`), eso sí es un
cambio de enrutamiento (wildcard DNS + middleware leyendo el subdominio)
que queda fuera del alcance de esta fase — el catálogo público ya funciona
hoy vía `/store/[slug]`, que es portable a cualquier dominio sin cambios.

## 32–33. CI/CD y migraciones

- **Migraciones:** ya versionadas como archivos numerados en
  `supabase/migrations/`, aplicadas manualmente por el usuario en el SQL
  Editor de Supabase en este proyecto hasta ahora. Antes del piloto real,
  considerar migrar a `supabase db push` vía el CLI de Supabase con el
  proyecto vinculado (`supabase link`), para que las migraciones se
  apliquen de forma reproducible y quede un historial de qué se corrió y
  cuándo, en vez de pegar SQL manualmente.
- **CI/CD:** Vercel ya provee el pipeline básico (push a Git → build →
  deploy) con Preview Deployments automáticos por PR y Production
  deployments desde la rama principal — eso ya es CI/CD funcional sin
  configuración adicional. Lo que falta agregar antes de un piloto:
  - Un paso de `npx tsc --noEmit` + `npx eslint .` como GitHub Action que
    bloquee el merge si falla (hoy esa verificación se hace manualmente en
    cada fase de este build, pero no está automatizada como gate de PR).
  - Separar claramente qué rama es "staging" (deploys a Preview, apuntando
    al proyecto de Supabase de staging) de cuál es "production" (rama
    `main`, apuntando al proyecto de Supabase de producción) — hoy todo
    corre contra un único proyecto de Supabase.

## 34–35. Pruebas y pruebas de seguridad

Checklist funcional (para correr manualmente contra staging antes del
piloto — no hay suite automatizada de tests en este repo todavía):

- **Auth:** registro → confirma que crea `profiles` + primera empresa con
  trial de 14 días; login con credenciales correctas/incorrectas; logout
  realmente invalida la sesión (confirmar que `/dashboard` redirige a
  `/login` después); recuperar contraseña de punta a punta.
- **Multi-tenant:** con dos cuentas de dos empresas distintas, confirmar
  que ninguna puede ver clientes/productos/ventas/reportes de la otra ni
  manipulando la URL (ej. `/clientes/<id-de-otra-empresa>` debe dar 404 o
  vacío, nunca los datos).
- **Ventas:** crear, anular (`void_sale`), confirmar que anular no borra la
  fila ni descuenta stock dos veces.
- **Inventario:** entrada, salida, ajuste, y una venta con producto de
  variantes — confirmar que descuenta la variante correcta, nunca el stock
  del producto padre.
- **Caja:** abrir, registrar movimientos, cerrar con diferencia y sin
  diferencia.
- **Pedidos:** crear desde el catálogo público, confirmar, cancelar, y el
  flujo completo hasta entregado + pago contra entrega generando el
  movimiento de caja correspondiente una sola vez.
- **Delivery:** pedido con zona válida, zona inexistente (debe rechazar),
  pedido por debajo del mínimo de la zona (debe rechazar).
- **Suscripciones:** trial activo, límite de productos/clientes alcanzado
  (debe bloquear la creación con el mensaje correcto), upgrade/downgrade
  simulados desde `/configuracion?tab=plan`.
- **IA:** sin plan Pro, la ruta `/asistente-ia` debe redirigir; con Pro,
  alcanzar el límite mensual simulado (insertando filas de prueba en
  `ai_usage`) y confirmar que `log_ai_query()` rechaza la siguiente.
- **Automatizaciones:** activar una plantilla, confirmar que respeta el
  límite de 10 activas, pausar/reactivar.
- **Super Admin:** con una cuenta normal (no en `platform_admins`),
  confirmar que `/admin` redirige a `/dashboard` — y que llamar cualquier
  función `admin_*` directamente (ej. desde el SQL Editor autenticado como
  ese usuario) lanza "No autorizado."

Pruebas de seguridad activas (intentar y confirmar que todas fallan):
- Editar el payload de una Server Action en las DevTools para enviar el
  `company_id` de otra empresa → la función RPC/RLS debe rechazarlo.
- Llamar `admin_change_plan`/`admin_suspend_company`/etc. desde una cuenta
  sin `is_platform_admin()` → debe lanzar excepción.
- Enviar un `delivery_fee_cents` manipulado al crear un pedido público → el
  valor real siempre se recalcula server-side desde `delivery_zones`,
  ignorando cualquier costo que el cliente intente enviar (confirmar que
  el parámetro ni siquiera existe en `create_public_order`).
- Intentar leer `ai_usage`/`automation_usage`/`admin_audit_logs` de otra
  empresa vía la API REST de Supabase directamente → RLS debe devolver
  cero filas.

## 36. Prueba de carga

No ejecutada en esta fase (requiere un entorno de staging con datos
sintéticos y una herramienta como k6/Artillery). Antes del piloto,
recomendado un script simple de k6 que simule:
- 10, 50, 100, 500 empresas con datos sintéticos (usar un script que
  inserte vía `create_company_with_owner` + ventas/productos de prueba en
  lote).
- Medir tiempo de respuesta de: `/dashboard`, `/reportes/ventas` con un mes
  de datos, `/admin` (dashboard global) con las 500 empresas sintéticas,
  y `create_public_order` con concurrencia (simulando la compra
  simultánea de las últimas unidades de un producto, para confirmar en la
  práctica lo que ya se garantiza por diseño con el `for update` de la
  transacción).
- Documentar los resultados y cualquier cuello de botella encontrado en
  este mismo archivo, en una sección nueva, cuando se ejecute.

## 37. Costos de infraestructura (estimado inicial, a refinar con uso real)

| Servicio | Plan inicial estimado | Costo aprox./mes |
|---|---|---|
| Vercel | Pro (necesario para dominio propio + límites de función razonables) | ~$20 |
| Supabase | Pro (backups con PITR, límites más altos) | ~$25 |
| VPS para n8n | 2 vCPU / 4 GB | ~$12–20 |
| Proveedor de IA (Pro plan, 100 consultas/empresa/mes) | Variable según modelo elegido — estimar con el costo por 1K tokens del proveedor × consumo promedio observado en `ai_usage` | Por definir tras el piloto |
| Dominio | Anual, prorrateado | ~$1–2 |

**Costo promedio por empresa** = (suma de los costos fijos de arriba) /
(número de empresas activas) + el costo variable de IA de esa empresa
específica (calculable directamente desde `ai_usage.input_tokens` /
`output_tokens` una vez haya consumo real). Con esta fórmula, y una vez
haya datos reales de `ai_usage`/`automation_usage` de al menos un mes, se
puede validar si $5/$9/$20 cubren el costo real — la instrumentación para
calcularlo (`ai_usage`, `automation_usage`) ya existe desde la Fase 13; solo
falta una vista de Super Admin que la agregue (siguiente paso natural en
`/admin`, ver `docs/fase-13-ia-automatizaciones.md` §7).

## 38. Seguridad financiera

Confirmado en la auditoría de esta fase (ver resumen abajo): precios,
descuentos, impuestos, costo de delivery y totales nunca se confían desde
el frontend para operaciones que muevan dinero real — se recalculan
siempre dentro de las funciones `security definer` correspondientes.

## 39. Auditoría

`admin_audit_logs` (Fase 12) ya cubre las acciones administrativas
sensibles (cambio de plan, suspensión, reactivación, trial). Lo que NO
tenía cobertura de auditoría todavía a nivel de negocio (cambio de precio,
anulación de venta, ajuste de inventario, cierre de caja) se revisó en
esta fase — ver el resumen de cambios abajo para el detalle de qué se
agregó.

## 40. Política de retención (definición inicial)

| Dato | Retención inicial propuesta | Nota |
|---|---|---|
| Ventas, pedidos, movimientos de caja, gastos | Indefinida | Son el registro histórico del negocio — no aplica una política de borrado, es responsabilidad del propio negocio decidir si algún día quiere exportar/depurar |
| `ai_usage` (historial de consultas IA) | 12 meses | Suficiente para soporte y análisis de consumo; después, agregable a un resumen mensual y purgable |
| `automation_usage` (ejecuciones) | 6 meses | Solo operacional, sirve para debug de fallos recientes |
| `admin_audit_logs` | 24 meses | Auditoría administrativa — retención más larga por su naturaleza de cumplimiento |
| Logs de aplicación (Vercel) | Según el plan de Vercel | Fuera del control directo de bizko |

No se implementó un job de purga automática en esta fase — es una decisión
de producto pendiente de confirmar antes de programarla (spec §40 dice
explícitamente "definir posteriormente" y "no borrar datos críticos
automáticamente sin política clara"), esta tabla es la propuesta inicial
para esa conversación, no una política ya activa.

## 41–43. Checklist final de esta fase

| Ítem | Estado |
|---|---|
| RLS auditado tabla por tabla | ✅ (ver `0017_production_hardening.sql`) |
| SECURITY DEFINER functions con guard de autorización | ✅ Verificado |
| Seguridad financiera (recálculo server-side) | ✅ Verificado |
| Manejo de errores (sin leaks técnicos al usuario) | ✅ Verificado/ajustado |
| Índices en columnas calientes | ✅ Ajustado donde faltaba |
| Idempotencia (ventas, caja, ejecuciones) | ✅ Columnas/índices preparados |
| Storage / validación de uploads | ✅ Verificado/ajustado |
| Auditoría de negocio (precio, anulación, ajustes, cierre) | ✅ Ampliada |
| Dominio propio | ⏳ Pendiente de contratar/configurar en Vercel |
| HTTPS | ✅ Automático vía Vercel para el dominio que se configure |
| Backups probados con restauración real | ⏳ Pendiente — requiere plan pagado de Supabase con PITR |
| VPS + n8n desplegado | ⏳ Pendiente — checklist listo en §17-19 |
| Monitoreo activo (alertas) | ⏳ Pendiente — checklist listo en §22-23 |
| Rate limiting | ⏳ Pendiente — requiere Upstash u equivalente |
| CI/CD con gate de tsc/eslint | ⏳ Pendiente — agregar GitHub Action |
| Prueba de carga | ⏳ Pendiente — requiere entorno de staging con datos sintéticos |

---

## Resumen de la auditoría y cambios de código de esta fase

**Verificado, sin hallazgos que corregir:**
- Las 48 tablas del esquema tienen RLS habilitado (ninguna quedó expuesta
  sin políticas).
- Todas las funciones `security definer` revisadas validan
  `is_company_member()`/`is_company_owner()`/`is_platform_admin()` (o un
  `raise exception` explícito) antes de tocar datos — no se encontró
  ninguna sin ese guard. Los restos del modelo de auth de la Fase 1
  (`app_users`, `current_company_id()`, `current_user_role()`,
  `is_super_admin()`) ya habían sido eliminados limpiamente en la Fase 2 —
  no quedó código huérfano.
- Los totales de venta/pedido y el costo de delivery se recalculan siempre
  server-side (`create_sale`, `create_public_order`) — ningún monto
  calculado por el cliente se inserta tal cual.
- Los mensajes de error mostrados al usuario en las Server Actions
  provienen siempre de `raise exception` propios (ya en español, ya
  pensados para mostrarse) — no se encontró ningún caso de un error crudo
  de Postgres/PostgREST llegando al usuario final.
- Las políticas de Storage ya aíslan cada empresa por carpeta
  (`is_company_member` sobre el primer segmento de la ruta) — un nombre de
  archivo manipulado no puede escribir fuera de la carpeta de la propia
  empresa, porque esa carpeta la fija el código del servidor, no el
  archivo.
- **Hallazgo de riesgo bajo, aceptado por diseño:** `list_public_order_items`
  (y el patrón equivalente en `get_public_order`) autorizan el acceso solo
  con la posesión de un UUID de pedido no adivinable — el mismo patrón que
  usan Stripe/Shopify para sus páginas de confirmación de pedido enviadas
  por link. No hay verificación adicional de que quien pide los datos sea
  realmente el cliente. Riesgo real bajo (122 bits de entropía, no hay ID
  secuencial que enumerar), pero queda documentado aquí como decisión
  consciente, no como descuido.

**Cambios aplicados** (`supabase/migrations/0017_production_hardening.sql`):
- Índices que faltaban en columnas usadas por reportes/dashboards:
  `sales (company_id, created_at desc)`, `order_items (order_id)` (no tenía
  ningún índice), `expenses (company_id, spent_at desc)`.
- `idempotency_key` (con índice único parcial) en `sales`, `cash_movements`
  y `automation_usage`, preparado para cuando el checkout/dispatch de
  automatizaciones empiece a enviarlo.
- Tabla `business_audit_logs` nueva (distinta de `admin_audit_logs` de la
  Fase 12, que es solo para el Super Admin) — visible para la propia
  empresa vía RLS. `void_sale()` y `close_cash_register()` ahora registran
  ahí `SALE_VOIDED`/`CASH_REGISTER_CLOSED`. El cambio de precio de un
  producto se registra como `PRICE_CHANGED` desde
  `updateProductAction` (`src/app/(app)/productos/actions.ts`), solo
  cuando el precio realmente cambió. El ajuste manual de inventario ya
  tenía su propio rastro completo en `inventory_movements`
  (usuario, motivo, stock anterior/nuevo, fecha) desde la Fase 7 — no se
  duplicó en `business_audit_logs` para no repetir la misma información en
  dos tablas.
- Límites de tamaño y tipo de archivo configurados a nivel de bucket en
  Storage (5 MB / solo imágenes para logos y fotos de producto; 15 MB /
  imágenes y PDF para documentos) — antes no había ningún límite más allá
  del aislamiento por carpeta. `src/lib/storage.ts` valida lo mismo del
  lado del cliente antes de subir (mensaje inmediato en vez de esperar el
  rechazo del servidor) y sanea el nombre de archivo antes de usarlo en la
  ruta.

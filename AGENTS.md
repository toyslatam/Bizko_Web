<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# bizko

SaaS multi-tenant para pequeños negocios (panadería, frutas y verduras,
lavado de motos, barbería, lavandería, mascotas, taller, comida, boutique).
Ver `public/files/Bizko_Manual_de_Marca.pdf` para marca/colores/tipografía.

- CORE compartido en `src/app/(app)/*` + `src/lib/nav-config.ts`.
- Verticales (aún sin lógica) en `src/modules/*`, registro en `src/modules/registry.ts`.
- Multi-tenant: toda tabla de negocio cuelga de `company_id`, RLS en
  `supabase/migrations/0001_init.sql` (+ storage en `0002_storage.sql`).
- Planes/features: `src/lib/plans.ts`. Roles/permisos: `src/lib/permissions.ts`.
- Datos de demo (dashboard) en `src/lib/demo-data.ts` — nunca mezclar con
  la capa real de Supabase (`src/lib/supabase/*`).
- Supabase aún no está aprovisionado (falta `vercel login` + `vercel integration
  add supabase`); hasta entonces la app corre en modo demo.

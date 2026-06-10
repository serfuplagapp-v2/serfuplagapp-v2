@AGENTS.md

# Serfuplagapp v2 — Guía para Claude Code

La **fuente de verdad** está en `docs/` (léela antes de escribir código):

- `docs/01_ARQUITECTURA_V2.md` — arquitectura (leer completo).
- `docs/02_PLAN_FASES.md` — el trabajo va **una fase a la vez**.
- `docs/03_MIGRACION.md`, `docs/04_DICCIONARIO_DATOS.md`, `docs/05_DIAGNOSTICO_V1.md`.

## Reglas duras

- El usuario (Carlos) **NO es programador**: explica simple, sin jerga, con pasos numerados.
- **TypeScript estricto**; prohibido `any` sin justificación en comentario.
- Toda query a la base de datos se **filtra y pagina en el servidor** (nunca traer tablas completas al cliente).
- Código (tablas, variables, funciones) en **inglés**; la UI visible en **español de Chile**.
- **Una migración SQL por cambio de esquema** en `supabase/migrations/` (nunca a mano en el dashboard).
- **RLS habilitado siempre** en tablas de negocio. Patrón estándar:
  `for all using (tenant_id = public.current_tenant_id())`.
- **Identidad visual heredada de la v1** — tokens en `src/app/globals.css`. No inventar paleta nueva.
- Tras cada fase: explicar **qué** se construyó y **cómo probarlo**, en lenguaje no técnico.
- Mantener `HISTORIAL.md`. Ideas nuevas → `BACKLOG.md`, no implementarlas al vuelo.
- Si una propuesta se desvía del stack de `01_ARQUITECTURA_V2.md`, la respuesta por defecto es **no**.

## Estado (al 10-jun-2026)

- **Fase 0 (fundaciones): completada.** Auth en español + migración 0001 (tenants/profiles, RLS). Carlos = `owner` de "Serfuplagas Ltda.".
- **Fase 1 (planificador): construida y desplegada (parcial).**
  - Migración **0002** aplicada en producción: clients, branches, contacts (flags
    destinatario/CC/WhatsApp), service_types (6 sembrados), contracts (con `oc_number`,
    `oc_file_path`, `billing_mode`), technicians, services con **DOS estados**
    (`agenda_status` + `field_status`), service_technicians, routes, route_stops, geocode_cache.
  - **Aislamiento reforzado:** FKs COMPUESTAS con `tenant_id` + `unique(tenant_id,id)`
    en los padres → imposible enlazar entre empresas (ver 04 decisión #9). Toda tabla nueva igual.
  - CRUD de clientes/sucursales/contactos (búsqueda + paginación en servidor) en `src/app/(protected)/clientes`.
  - Calendario semanal con filtro por técnico en `src/app/(protected)/agenda` (zona Chile vía `src/lib/datetime.ts`).
  - geocode_cache: sin acceso para `authenticated` (server-only); el mapa la usará vía service_role/función definer.

- **Importación de datos reales (Firestore v1 → Supabase): HECHA y validada (10-jun).**
  267 clientes, 540 sucursales, 434 contactos en producción (agrupados por RUT;
  coordenadas heredadas de la v1). Herramientas en `migration/` (export/transform/load/verify,
  Node + firebase-admin + pg). Migración **0003** agregó `branches.notes`. Detalle en HISTORIAL.
  Pendiente menor de Carlos: 2 RUT sin DV (Educain, El Gran Corte), RUT de ABINGRAF, borrar test `dasda`.

- **Mapa de sucursales: HECHO y en vivo (10-jun).** Módulo `/mapa` con pines AGRUPADOS
  (`@vis.gl/react-google-maps` + `@googlemaps/markerclusterer`), clic → InfoWindow + enlace a la ficha.
  Llave Google Maps (la misma de la v1) en env `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`; el proyecto GCP
  `serfuplagapp-e436d` lo administra la cuenta **serfuplagapp@gmail.com**. Detalle en HISTORIAL.

- **PENDIENTE (lo próximo):**
  1. Geocodificar las **5 sucursales sin coordenadas** (geocoder cliente con SDK + guardar en branch).
  2. Integrar el mapa a la **Agenda** para rutas de técnicos (optimizar ruta + Routes API; ver patrones v1).
  3. Arreglos menores de Carlos en datos: 2 RUT sin DV (Educain, El Gran Corte), RUT de ABINGRAF, borrar test `dasda`.

- **Datos del entorno:** App en https://serfuplagapp-v2.vercel.app · Supabase project ref `dzlgdwtfqlxkibgyxnin`
  (org "Serfuplagas LTDA", región São Paulo) · GitHub `serfuplagapp-v2/serfuplagapp-v2` (público).
  La conexión a Supabase está en `.env.local` (local, no en el repo).
- **Docs fuente de verdad** (en OneDrive y en `docs/` local): 01_ARQUITECTURA y 04_DICCIONARIO
  ya reflejan las decisiones de Fase 1 (dos estados, FKs compuestas, campos de contrato).
  Lo comercial (OC puntual, movements `pagado`, movement_services, factura consolidada) es **Fase 2**.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript estricto · Tailwind v4 · shadcn/ui ·
Supabase (Postgres + RLS + Auth + Storage) · Vercel.
**Nota Next.js 16:** el antiguo `middleware.ts` se llama `proxy.ts`.

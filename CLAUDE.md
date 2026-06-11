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

- **Fase 2 (Comercial): módulo construido y en vivo (10-jun).** Migraciones **0004**
  (movements, movement_services, dte_documents — RLS + FKs compuestas) y **0005**
  (función `movements_summary` para totales en servidor). Módulo `/comercial`: dashboard
  (ventas mes / mes anterior / total), lista con filtros (mes/tipo/búsqueda) + totales +
  paginación, y formulario para registrar movimientos (NC con monto negativo automático).
  **DECISIÓN Carlos:** NO se importa el Excel histórico "Informe Diario" — se registra
  directo en la app de aquí en adelante. Cierre de fase = Carlos usándolo en la operación real.

- **DECISIÓN (10-jun): PARIDAD TOTAL v1→v2 + mantener la historia desde el 1-may-2026.**
  La v1 es un ERP completo de control de plagas. Revisión en detalle + roadmap de porte en
  **`docs/06_REVISION_V1_PORTE.md`**. Orden acordado: cerrar Fase 2 (uso) → **completar el
  Planificador** → Terreno/certificados (Fase 3) → SII/Portal (Fase 4) → CRM/cartola/RR.HH./IA-UV.

- **Planificador (EN CURSO — cierre real de Fase 1):**
  - **Motor de agendamiento PORTADO** de la v1 → `src/lib/scheduling.ts` (periodicidades,
    modos de visita, feriados chilenos; funciones puras). Migración **0006**: `visit_mode`,
    `visit_params`, `allowed_days`, `preferred_time` en `contracts`.
  - **Historia desde 1-may IMPORTADA** (migración **0007**: `legacy_id` en
    clients/branches/contracts/services + `services.legacy_data` jsonb). Cargados
    **135 contratos + 1.238 servicios** (órdenes con `fecha_programada` ≥ 1-may), enlazados por
    `legacy_id` (540/540 sucursales). Dos estados mapeados (estado_cal→agenda, estado_op→field).
    **Data de certificados PRESERVADA en `services.legacy_data`** (folio, plagas, productos,
    áreas, firmante…); folio máx **30696** → los certificados (Fase 3) continúan desde **30697**.
  - Tooling: `migration/diagnose-ot.mjs`, `import-ot-preview.mjs`, `load-ot.mjs`, `verify-ot.mjs`.
    Migraciones se aplican con `node migration/apply-sql.mjs <archivo.sql>` (conexión en `Secretos/db.txt`).

- **Planificador COMPLETO (11-jun):** generador de servicios + calendario terminados.
  - **Generador:** `src/lib/generator.ts` (computeProposals) sobre el motor `generarVisitas`
    de `scheduling.ts`. Política **roll-forward** (solo propone DESPUÉS del último servicio
    de cada contrato → 0 duplicados, validado con los 135 contratos reales). UI:
    `/agenda/generar` (vista previa + crear como `propuesto`) y `/agenda/propuestas`
    (aprobar→`programado` / descartar). visit_mode heredados raros se normalizan.
  - **Calendario:** drag&drop entre días (conserva la hora) + selector de técnico por
    tarjeta (`week-grid.tsx`). **Ruta del día** `/agenda/ruta`: vecino más cercano +
    "Optimizar por calles" (Routes API, requiere env `GOOGLE_MAPS_SERVER_KEY`; opcional),
    link a Google Maps, guardar ruta (migración **0008** polyline/distance/duration).
  - **`/tecnicos`:** alta y activar/desactivar técnicos.
  - **Fix CRÍTICO de zona horaria:** `santiagoLocalToISO` reescrita (la anterior solo era
    correcta en servidores UTC; en hora de Chile corría la hora 3–4 h). Probada en 3 zonas
    con bordes de DST (`migration/test-datetime.mts`). Revisión adversarial completa +
    arreglos de manejo de errores (lotes, rutas, propuestas) aplicados — ver HISTORIAL 11-jun.

- **Estructura de módulos v1 COMPLETA en el menú (11-jun, 2ª sesión).** Decisión Carlos:
  paridad de módulos y UI/UX con la v1, velocidad primero. Menú lateral réplica del
  rediseño v1 (4 secciones, activo amarillo `#FFD43B` sobre navy, header `#122850`).
  Módulos nuevos: **`/ordenes`** (lista OT estilo v1: pestañas con contadores y colores v1,
  folio desde `legacy_data->>folio`, filtros, 50/pág), **`/pendientes`** (tareas manuales
  v1, migr. **0010** `tasks`), **`/configuracion`** (empresa editable owner/admin —
  migr. **0009** —, chips de tipos de servicio, equipo), **`/panel`** = tablero de alertas.
  Placeholders con fase declarada: CRM, Terreno, Layouts, OC, Stock, Casos Esp., Plantillas.
  Mapeos: Facturación→`/comercial`, RR.HH.→`/tecnicos`, Agenda Op.→`/agenda/ruta`.
  OJO: `/panel` usa `getSessionProfile` (NO `requireEnabledProfile`, evita bucle).

- **PENDIENTE (lo próximo, en orden):**
  1. **Fase 3 — Terreno/certificados**: tablas products/certificates/layouts/stations/station_checks;
     generar el certificado PDF con folio correlativo desde **30697** usando la data en `services.legacy_data`.
  2. Seguir el roadmap de paridad (SII/Portal, CRM, cartola, RR.HH., IA-UV — ver `docs/06`).
  3. **Limpiezas/tareas de Carlos:** crear técnicos en `/tecnicos`; borrar test `dasda` + clientes
     duplicados (Globe ×3, El Gran Corte ×2…), 2 RUT sin DV (Educain, El Gran Corte), RUT de ABINGRAF;
     geocodificar 5 sucursales sin coords; registrar movimientos en `/comercial` (cierre Fase 2);
     (opcional) llave `GOOGLE_MAPS_SERVER_KEY` en Vercel para optimizar rutas por calles.

- **Datos del entorno:** App en https://serfuplagapp-v2.vercel.app · Supabase project ref `dzlgdwtfqlxkibgyxnin`
  (org "Serfuplagas LTDA", región São Paulo) · GitHub `serfuplagapp-v2/serfuplagapp-v2` (público).
  La conexión de la app a Supabase está en `.env.local` (local, no en el repo).
- **Secretos (carpeta `Secretos/`, IGNORADA por git — nunca subir):** `db.txt` = conexión Postgres
  para migraciones/imports (pooler **aws-1-sa-east-1**, no el host directo `db.<ref>` que no resuelve);
  `firebase-v1.json` = llave de servicio de Firebase v1 (solo lectura); `maps.txt` = llave Google Maps.
- **Rendimiento:** funciones de Vercel fijadas en **gru1 (São Paulo)** vía `vercel.json` (la base está ahí
  también). El proyecto GCP `serfuplagapp-e436d` lo administra la cuenta Google **serfuplagapp@gmail.com**.
- **Migración v1→v2:** la v1 (código vanilla JS) está en
  `OneDrive\...\CARPETA COMPARTIDA SERFUPLAGAS\027_APP\Cowork`. Patrones a portar en `docs/06_REVISION_V1_PORTE.md`.
- **Docs fuente de verdad** (en OneDrive y en `docs/` local): 01_ARQUITECTURA y 04_DICCIONARIO
  ya reflejan las decisiones de Fase 1 (dos estados, FKs compuestas, campos de contrato).
  Lo comercial (OC puntual, movements `pagado`, movement_services, factura consolidada) es **Fase 2**.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript estricto · Tailwind v4 · shadcn/ui ·
Supabase (Postgres + RLS + Auth + Storage) · Vercel.
**Nota Next.js 16:** el antiguo `middleware.ts` se llama `proxy.ts`.

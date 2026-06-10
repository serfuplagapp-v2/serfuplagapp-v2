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

## Estado

- **Fase 0 (fundaciones): completada.** Auth en español + migración tenants/profiles con RLS.
- Siguiente: **Fase 1 — Planificador** (clientes, sucursales, servicios, rutas).

## Stack

Next.js 16 (App Router) · React 19 · TypeScript estricto · Tailwind v4 · shadcn/ui ·
Supabase (Postgres + RLS + Auth + Storage) · Vercel.
**Nota Next.js 16:** el antiguo `middleware.ts` se llama `proxy.ts`.

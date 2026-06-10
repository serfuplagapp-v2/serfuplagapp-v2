# Backlog — Serfuplagapp v2

> Regla de oro #1: una fase a la vez. Si surge una idea nueva, se anota aquí, no se
> implementa todavía.

## Fase 1+

- **Gestión de miembros del equipo**: función SQL con control de permisos (RPC
  `SECURITY DEFINER`) para que un `owner`/`admin` asigne empresa y rol a usuarios
  nuevos desde la app. Hoy (Fase 0) eso se hace por SQL manual.
- **TanStack Query** para cache de datos en el cliente (definido en el stack, se
  incorpora cuando haya listados que consultar — Fase 1).

## Patrón de seguridad a seguir (Fase 1+)

- Toda página o Server Action que lea/escriba datos del tenant debe llamar a
  `requireEnabledProfile()` (`src/lib/auth.ts`) y/o confiar en la RLS. El layout
  protegido solo controla lo que se MUESTRA, no es la barrera real de datos.
- Toda tabla de negocio nueva: RLS habilitada + política
  `for all using (tenant_id = public.current_tenant_id())`.

## Seguridad / operación

- Antes de producción real: configurar un remitente de correo propio (SMTP) en
  Supabase y decidir si se reactiva la confirmación de correo (si se desactivó para
  facilitar las pruebas de la Fase 0).
- Tabla `audit_log` (quién cambió qué) — Fase 5 SaaS.

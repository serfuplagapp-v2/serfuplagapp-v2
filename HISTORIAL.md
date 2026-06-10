# Historial de trabajo — Serfuplagapp v2

> Resumen de cada sesión de trabajo (continúa la práctica de la v1).

## 2026-06-10 — Fase 0: Fundaciones

**Qué se construyó:**

- Proyecto **Next.js 16** (App Router) + **TypeScript estricto** + **Tailwind v4** + **shadcn/ui**.
- **Identidad visual heredada de la v1**: navy `#1B3A6B`, navy oscuro `#122850`, verde
  `#1E6B3A`, naranja `#B85C00`, rojo `#C0392B`, grises `#F5F6FA→#333640`, tipografía
  Segoe UI, radios 10px/6px. Configurado como tema en `src/app/globals.css`.
- **Supabase Auth en español**: iniciar sesión, crear cuenta, recuperar contraseña y
  cambiar contraseña, con mensajes de error traducidos.
- **Migración `0001_init_tenants_profiles.sql`**: tablas `tenants` y `profiles` con
  RLS y aislamiento por empresa (funciones `current_tenant_id()` / `current_user_role()`).
- **Seguridad por diseño**: un usuario nuevo nace SIN empresa ni rol → sin acceso a
  datos hasta ser habilitado. Corrige el bug "todos admin por defecto" de la v1
  (05_DIAGNOSTICO_V1 §2.1). Además, a nivel de columna, un usuario no puede cambiar
  su propio rol ni empresa.
- Pantalla "cuenta no habilitada" para usuarios autenticados sin asignación.

**Notas técnicas:**

- En Next.js 16 el antiguo `middleware.ts` se llama **`proxy.ts`** (corre en Node.js).

**Pendiente (lo hace Carlos, guiado):** conectar el proyecto Supabase, crear el repo en
la organización GitHub `serfuplagas`, desplegar en Vercel, aplicar la migración + seed,
y asignarse como `owner`.

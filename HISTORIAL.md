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

**Desplegado y verificado (mismo día):**

- App en vivo: **https://serfuplagapp-v2.vercel.app** (Vercel, equipo Hobby).
- Repo: **`serfuplagapp-v2/serfuplagapp-v2`** (GitHub) — público (Vercel Hobby no despliega
  repos privados de organización; revertir a privado + Vercel Pro a futuro). Los documentos
  de planificación se quitaron del repo público (siguen locales y en OneDrive).
- Supabase: proyecto `serfuplagapp-v2` (ref `dzlgdwtfqlxkibgyxnin`, región São Paulo);
  migración 0001 + seed aplicados; empresa "Serfuplagas Ltda." creada; Carlos asignado
  como `owner`. "Confirm email" DESACTIVADO temporalmente (reactivar antes de producción real).
- **Criterios de cierre cumplidos:** (1) login OK desde celular y PC; (2) un usuario de
  prueba fue rechazado con "cuenta no habilitada" → aislamiento por empresa verificado en
  producción (corrige el bug "todos admin" de la v1).

**Siguiente:** Fase 1 — Planificador (clientes, sucursales, técnicos, servicios, rutas).

## 2026-06-10 — Fase 1: Planificador (en progreso)

**Qué se construyó:**

- **Migración 0002** (aplicada en producción): clientes, sucursales, contactos
  (flags destinatario/CC/WhatsApp), tipos de servicio (6 sembrados), contratos
  (con `oc_number`, `oc_file_path`, `billing_mode`), técnicos, servicios con
  **DOS estados** (agenda_status + field_status, decisión de Carlos), tabla puente
  service_technicians, rutas, route_stops, geocode_cache (server-only).
- **Aislamiento reforzado:** FKs **compuestas con tenant_id** + `unique(tenant_id,id)`
  → imposible enlazar registros entre empresas a nivel del motor (corrige un hallazgo
  HIGH de la revisión adversarial de seguridad de Fase 1).
- **CRUD de clientes/sucursales/contactos** con búsqueda y paginación EN SERVIDOR.
- **Calendario semanal** de servicios con filtro por técnico (hora de Chile), estilo v1.
- Navegación: Clientes y Agenda en el menú (con versión móvil).
- Verificado en producción: páginas Clientes y Agenda cargan OK contra el nuevo esquema.

**Pendiente (gated por confirmación de Carlos):**
- Importación de datos reales desde Firestore (clientes/sucursales/contactos), con la
  agrupación de sucursales (`sucursal:true`) bajo su casa matriz.
- Mapa del planificador (Google Maps, UNA instancia) — DESPUÉS de la importación.

**Nota:** los nuevos campos comerciales que Carlos agregó al doc (OC puntual,
movements con `pagado`, movement_services, factura consolidada) son **Fase 2**.

## 2026-06-10 — Importación de datos reales (Firestore v1 → Supabase)

**Qué se hizo:**

- Herramientas de un solo uso en `migration/` (Node + firebase-admin + pg), fuera de la app:
  `export.mjs` (descarga la v1, solo lectura), `transform.mjs` (mapea v1→v2 y genera vista
  previa en JSON + CSV para revisar en Excel), `load.mjs` (carga transaccional) y
  `verify.mjs` (validación). Claves y datos exportados quedan en carpetas ignoradas por git
  (`Secretos/`, `migration/exports/`); nunca llegan al repo público.
- **Diagnóstico (confirmado con los datos):** la v1 tiene 546 fichas de cliente (1 empresa).
  Las sucursales se agrupan por **RUT compartido** + `sucursal:true`; las coordenadas
  (lat/lng) ya venían pobladas en la v1, así que se traen y el mapa queda casi pre-hecho.
- **Migración 0003:** se agregó el campo `notes` a `branches` para conservar datos por local
  (frecuencia, días de visita, cartera, dirección tributaria, rubro…) que aún no tienen
  pantalla propia. Aditiva y segura.
- **Cargado y validado en producción:** 267 clientes, 540 sucursales, 434 contactos
  (cuadre 546 = 540 + 6 excluidos; 0 sucursales huérfanas; 535/540 con coordenadas).
  Los contactos repetidos en varias sucursales quedaron una sola vez a nivel cliente.
- **Decisiones de Carlos aplicadas:** nombre de sucursal = fantasía + razón social; extras → Notas;
  Educain se deja con sus 2 locales reales; matrices duplicadas (HMGS, María Guisela) fusionadas;
  4 registros de prueba/basura excluidos; el "Tipo de cliente" no se importó (se agregará a futuro).

**Pendiente menor (lo hace Carlos en la app):** corregir 2 RUT sin dígito verificador
(Educain, El Gran Corte), agregar el RUT de ABINGRAF, y borrar el cliente de prueba `dasda`.

**Siguiente:** Mapa del planificador (Google Maps) — ahora que las sucursales tienen
dirección y coordenadas.

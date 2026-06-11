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

## 2026-06-10 — Rendimiento + Mapa de sucursales

**Rendimiento (resuelto):** las páginas con sesión demoraban varios segundos. Causa: las
funciones de Vercel corrían en `iad1` (Washington) y la base en `gru1` (São Paulo) → ~6 viajes
EE.UU.↔Brasil por página. La base responde en 0.3 ms (no era la consulta). Fix: `vercel.json`
con `"regions":["gru1"]` → servidor junto a la base. Verificado (`X-Vercel-Id` pasó a `gru1::gru1`).
Carlos confirmó la mejora.

**Mapa de sucursales (HECHO y en vivo):**

- Nuevo módulo **`/mapa`**: carga el SDK de Google Maps una sola vez
  (`@vis.gl/react-google-maps`), muestra todas las sucursales con coordenadas como **pines
  AGRUPADOS** (`@googlemaps/markerclusterer`); clic en un pin abre la sucursal/cliente con
  enlace a su ficha. Replica patrones probados de la v1 (`core/googlemaps.js`, `data/geocoder.js`):
  una instancia sin recrear, geocodificación con el SDK del navegador (las llaves restringidas por
  referrer no sirven por REST), limpieza de dirección y validación de comuna, rate-limit ~10/s.
- **Llave Google Maps:** se reutilizó la de la v1 ("Serfuplagapp - Google Maps") agregándole el
  dominio v2 y `localhost` a sus referrers; vive en `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`
  (Vercel + `.env.local`, nunca en el repo). El proyecto GCP lo administra `serfuplagapp@gmail.com`.
- Verificado en producción: el mapa carga centrado en Chile con los pines agrupados (Santiago ~510)
  y la ficha emergente funciona.

**Siguiente:** geocodificar las 5 sucursales sin coordenadas e integrar el mapa a la Agenda para rutas.

## 2026-06-10 — Fase 2: Módulo Comercial

**Decisión:** Carlos descartó importar el Excel histórico "Informe Diario 2026"
(~9.153 filas, 2021–2026). En vez de migrar historia vieja, el módulo se usa para
**registrar movimientos directo en la app de aquí en adelante** (criterio de cierre
de la fase). Tooling de Excel quedó disponible por si se reutiliza (bancos, etc.).

**Qué se construyó:**

- **Migración 0004:** `movements` (flujo cotizado→aprobado→facturado→pagado / rechazado;
  type venta|cotizacion|nota_credito; NC en negativo; OC; client_id/contract_id nullable),
  `movement_services` (factura consolidada) y `dte_documents` (DTE). RLS + FKs compuestas
  con tenant_id, igual que Fase 1.
- **Migración 0005:** función `movements_summary(from,to,type,q)` que suma/cuenta en el
  servidor respetando la RLS (totales del filtro y del dashboard, sin traer filas al cliente).
- **Módulo `/comercial`:** dashboard (ventas del mes, mes anterior con %, total histórico),
  lista con filtros (mes / tipo / búsqueda), total del filtro y paginación en servidor, y
  formulario `/comercial/nuevo` para registrar un movimiento (selector con los clientes
  cargados; la nota de crédito se guarda con monto negativo automáticamente).
- Tipos comerciales agregados a `types.ts`. Verificado en producción (módulo carga, dashboard
  en $0, formulario con los 267 clientes).

**Siguiente:** Carlos empieza a registrar movimientos (cierre de Fase 2). Luego: geocodificar
las 5 sucursales sin coordenadas y mapa-en-Agenda; más adelante Fase 3 (terreno).

## 2026-06-10 — Paridad total v1→v2: inicio del Planificador completo

**Decisión de Carlos:** portar la v1 COMPLETA a la v2 (paridad total) y mantener la
**historia desde el 1-may-2026**. Se generó un reporte de porte con una revisión en
paralelo de las 8 áreas de la v1 (8 agentes + síntesis) → `docs/06_REVISION_V1_PORTE.md`.
La v1 es un ERP completo; el roadmap acordado: cerrar Fase 2 (uso) → **completar el
Planificador** → Terreno/certificados → SII/Portal → CRM/cartola/RR.HH./IA-UV.

**Primer increment (cierre real de Fase 1 — Planificador):**

- **`src/lib/scheduling.ts`:** motor de agendamiento portado de la v1
  (`core/periodicidades.js` + `data/feriados.js`) — catálogo de periodicidades
  (semanal…anual), modos de visita (1er hábil, 2° viernes, días 1 y 15, etc.),
  feriados chilenos y `ajustarADiaHabil`. Funciones puras, en TypeScript.
- **Migración 0006:** agrega a `contracts` el detalle fino de periodicidad
  (`visit_mode`, `visit_params`, `allowed_days`, `preferred_time`) para que el
  generador sepa exactamente cuándo cae cada visita.

**Importación de historia desde 1-may (HECHA y verificada en producción):**

- **Migración 0007:** `legacy_id` en clients/branches/contracts/services (enlace a la
  v1, sin huérfanos) + `services.legacy_data` (jsonb) para **preservar la data de
  certificados** (folio, plagas detectadas, productos, áreas, firmante, metodología…).
- Tooling en `migration/`: diagnose-ot, import-ot-preview (vista previa CSV), load-ot
  (carga transaccional), verify-ot.
- **Cargado:** 135 contratos (desde programas activos) + **1.238 servicios** (OT con
  `fecha_programada` ≥ 1-may-2026), enlazados a clientes/sucursales por `legacy_id`
  (540/540 sucursales mapeadas). 13 OT huérfanas + 2 programas sin cliente omitidos
  (cuadre 1.238+13 = 1.251 ✅).
- **Dos estados mapeados** desde la v1: `estado_cal`→`agenda_status`,
  `estado_op`→`field_status`. La Agenda v2 ya muestra la operación real (may-2026 → may-2027).
- **Folio de certificados preservado** (máx 30.696) → en Fase 3 los certificados
  continúan desde 30.697, con toda la data en `services.legacy_data`.

**Siguiente:** wirear el generador de servicios (motor 0006) + completar el calendario
(drag&drop, ruta del día), y seguir el roadmap de paridad (Terreno/certificados, etc.).

## 2026-06-11 — Generador de servicios + calendario completo (drag&drop, ruta del día)

**Qué se construyó (cierre del Planificador):**

- **Motor de generación** (`src/lib/scheduling.ts` → `generarVisitas`): dado un contrato
  (frecuencia + modo de visita + días permitidos + hora preferida) y un rango, calcula
  todas las visitas, ajustadas a día hábil y feriados chilenos. Los `visit_mode`
  heredados de la v1 que el motor no conocía (`default`, `semana_x`, `1`, null) se
  normalizan a un modo válido según la frecuencia.
- **Política "roll-forward" (clave):** como la agenda YA tiene la operación real
  importada (1.238 servicios, may-2026→may-2027), el generador propone SOLO fechas
  posteriores al último servicio existente de cada contrato (programa completo si el
  contrato no tiene servicios). **Validado contra los 135 contratos reales: 914
  propuestas nuevas, 0 duplicados/casi-duplicados.**
- **`/agenda/generar`:** vista previa (total, desglose por mes, avisos de contratos sin
  sucursal clara y de truncado en 5.000) → botón que crea los servicios como `propuesto`.
  La vista previa y la inserción usan el MISMO cálculo (`src/lib/generator.ts`).
- **`/agenda/propuestas`:** aprobar (→ `programado`) o descartar, por cliente o todas.
- **Calendario con drag&drop** (`week-grid.tsx`): arrastrar una visita a otro día la
  reprograma conservando la hora; selector de técnico en cada tarjeta (actualiza
  `field_status` planificada↔asignada).
- **`/agenda/ruta` (ruta del día):** paradas numeradas en el mapa, orden por vecino más
  cercano (instantáneo, sin costo de API, portado de la v1 `optimizarRuta`), botón
  "Optimizar por calles" (Routes API; requiere `GOOGLE_MAPS_SERVER_KEY` en el servidor —
  si no está, sigue con cercanía), enlace "Abrir en Google Maps" y guardar ruta
  (migración **0008**: `routes.polyline/distance_km/duration_min`).
- **`/tecnicos`:** alta y activar/desactivar técnicos (la tabla estaba vacía y sin UI).

**Revisión adversarial (36 agentes) y arreglos aplicados:**

- **Zona horaria (el grave):** `santiagoLocalToISO` solo era correcta en servidores UTC;
  en una máquina en hora de Chile guardaba la hora 3–4 h corrida. Reescrita con
  `Intl.DateTimeFormat`/formatToParts + doble iteración; **probada en 3 zonas de
  servidor (Chile/UTC/Tokio) incluyendo bordes del cambio de hora: 15/15 ✅**
  (`migration/test-datetime.mts`).
- El filtro por cliente del generador se ignoraba (nombre de campo `client` vs
  `client_id`): corregido.
- Errores de guardado ya no pasan en silencio: lotes de `generateProposals` (aviso de
  generación parcial), aprobar/descartar, asignación de técnico en `createService`,
  y `saveRoute` (valida paradas contra la base, chequea errores y borra la ruta si
  las paradas fallan — nada queda a medias).
- Motor: invariante de zona horaria documentada y caso `puntual` corregido (mezclaba
  UTC/local); tipos de la ruta movidos fuera del archivo `"use server"`;
  `visit_params` (jsonb) saneado con `parseVisitParams`; fecha/hora obligatoria en el
  formulario de servicio; null-check en drag&drop; mensaje guía cuando no hay técnicos.

**Verificado:** typecheck/lint/build ✅ · test motor vs contratos reales (0 duplicados) ✅ ·
test zona horaria 15/15 ✅. Migración 0008 aplicada en producción.

**Pendiente que depende de Carlos:**
- Crear los técnicos reales en `/tecnicos` y asignarlos en la agenda.
- (Opcional) crear una llave de Google con Routes API habilitada y ponerla como
  `GOOGLE_MAPS_SERVER_KEY` en Vercel para "Optimizar por calles"; sin ella la ruta
  funciona por cercanía igual.

**Siguiente:** Fase 3 — Terreno/certificados (products/certificates/layouts/stations;
certificado PDF con folio desde 30.697 usando `services.legacy_data`).

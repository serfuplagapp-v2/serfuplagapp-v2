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

## 2026-06-11 (2ª sesión) — Estructura completa de módulos v1 + Pendientes, Órdenes y Configuración

**Decisión de Carlos:** avanzar con los demás módulos para entrar a producción pronto,
manteniendo los módulos y la UI/UX de la v1 (envió pantallazo del menú), con la velocidad
como prioridad.

**Menú lateral = réplica exacta de la v1** (`core/app.js` GRUPOS_ADMIN + `redesign.css`):
4 secciones (Principal / Comercial / Operaciones / Gestión) con los 16 módulos, item
activo con borde izquierdo amarillo `#FFD43B` sobre navy `#1B3A6B`, etiquetas de sección
en mayúsculas tenues, cabecera navy oscuro `#122850`. Mapeo:
- Ya operativos: Agenda→`/agenda`, Clientes→`/clientes`, Mapa (extra v2), Órdenes→`/ordenes`
  (NUEVO), Agenda Op.→`/agenda/ruta`, Pendientes→`/pendientes` (NUEVO),
  Facturación→`/comercial`, RR.HH.→`/tecnicos`, Configuración→`/configuracion` (NUEVO).
- En construcción (página propia que declara su fase): CRM (F5), Terreno (F3), Layouts (F3),
  Órdenes de Compra (F4), Stock (F3), Casos Especiales (F3), Plantillas (F5).

**Módulos NUEVOS construidos (sobre el esquema existente, consultas en servidor):**

- **`/ordenes` (Órdenes):** réplica de la lista v1 — pestañas por estado de terreno con
  CONTADORES y colores v1 (planificada gris, asignada azul, en proceso naranjo, por validar
  morado, terminada verde), columna **Folio** (desde `legacy_data->>folio` preservado),
  búsqueda cliente/RUT, filtros agenda/técnico/mes, orden fecha desc, 50 por página.
- **`/pendientes` (Pendientes):** réplica del módulo de TAREAS manuales de la v1
  (migración **0010**: tabla `tasks` con RLS) — crear con título/fecha/prioridad/cliente/
  notas, buckets Vencidas (rojo)/Hoy/Esta semana/Más adelante/Sin fecha, completar con
  checkbox, Completadas expandible, eliminar con confirmación.
- **`/configuracion` (Configuración):** datos de empresa (razón social/RUT, editable solo
  owner/admin; migración **0009** grant update), catálogo de tipos de servicio
  (agregar/activar/desactivar con chips), equipo con acceso + enlace a técnicos.
- **`/panel` (Inicio):** ahora es el tablero de alertas operativas (propuestas por aprobar,
  visitas atrasadas, próximos 7 días sin técnico, por validar, sucursales sin ubicación)
  con contadores en servidor y listas acotadas.

**Velocidad:** todo server-rendered sin JS extra; conteos con `head:true`; nombres solo de
la página visible; consultas en `Promise.all`; sin consultas en el layout (el menú no
consulta nada). Migraciones 0009/0010 aplicadas en producción.

**Siguiente:** Fase 3 — Terreno/certificados (el módulo de mayor valor pendiente).

## 2026-06-11 (3ª sesión) — Importación v1: certificados, facturación, layouts y catálogos

**Decisión de Carlos:** importar la información de la v1 para layouts, facturación,
órdenes (ya estaban desde 1-may) y generación de certificados — "todo".

**Migración 0011** (aplicada): `products`, `pests`, `predefined_texts`, `certificates`
(folio entero, FKs compuestas, SIN unique en folio porque la v1 tiene re-emisiones),
`layouts` (elementos/estaciones en jsonb; OJO: bg_image puede pesar cientos de KB —
las listas NUNCA deben seleccionarlo), `tenant_settings` (folio siguiente de certificado
y cotización + config legal/PDF en jsonb), y `legacy_id` en movements/dte_documents
(+`pdf_path` en dte).

**Importado y VERIFICADO (tooling en `migration/`: diagnose-fase3 / export-fase3 /
inspect-fase3 / check-layout-links / load-fase3 [--load] / load-fase3-facturas-huerfanas /
verify-fase3):**

- **386 certificados** (356 enlazados a su OT por `legacy_id`; folio 8.730→30.697;
  2 folios con re-emisiones v1: 29916×3, 29933×5). **Folio siguiente: 30.698**
  (de `empresa_config.folio_actual` — corrige el 30.697 que se creía antes).
- **66 movimientos** de facturación: 64 cobros v1 (mayo $305.873 + junio $846.090 =
  $1.151.963, cuadre EXACTO) + 2 facturas cuyo cobro fue borrado en la v1
  (Falabella $142.943 + una factura de PRUEBA a la propia Serfuplagas $119.000).
  Estados mapeados: borrador→aprobado, facturado, pagado, anulado→rechazado.
  62 enlaces movimiento↔OT (`movement_services`).
- **5 DTE** en `dte_documents` (4 tipo 33 + 1 NC tipo 61, con sus PDF urls).
- **12 layouts** (203 estaciones/figuras en total; 11 enlazados a su sucursal —
  los cliente_id v1 de layouts eran SUCURSALES v2, se resolvió vía `branches.legacy_id`).
- **Catálogos:** 43 productos, 14 plagas, 17 textos predefinidos.
- **tenant_settings:** folios + rep. legal/técnico, resolución sanitaria, colores PDF,
  firma técnico (base64) — todo lo que el PDF del certificado necesita en Fase 3.

**Hallazgos de enlace (resueltos en el transform):** los `cliente_id` v1 de cobros/
layouts/certificados podían apuntar a docs que en la v2 son sucursales (fusión por RUT) →
cadena de resolución legacy cliente → legacy sucursal → RUT → OT. 7 certificados quedaron
sin cliente (visitas técnicas y un cliente de prueba); data preservada en jsonb.

**UI para ver lo importado (mismo patrón server-side):** `/terreno` = historial de
certificados (busca por folio o cliente, 50/pág), `/layouts` = galería de planos con
miniatura y sucursal, `/stock` = catálogos (productos/plagas/textos). `/comercial` ya
muestra los 66 movimientos importados.

**Pendiente de Carlos:** borrar los registros de PRUEBA si corresponde (movimiento
"PRUEBA CLIENTE DTE LTDA" y factura de prueba a Serfuplagas; certificado folio 30005).

**Siguiente:** Fase 3 — generación de certificados nuevos (PDF con folio desde 30.698,
firma y datos legales ya disponibles en `tenant_settings`) + captura en terreno.

## 2026-06-11 (4ª sesión) — Detalle de OT, certificados nuevos, ficha cliente y flujo de facturación

**Decisión de Carlos:** avanzar con la generación de certificados y "lo demás de la app":
ficha de clientes, edición de órdenes de servicio (en la v1 se llaman **Órdenes de
Trabajo / OT**) y facturación. Se exploró la v1 a fondo (detalle.js + templates_v2.js)
para replicar campos, textos y flujo.

**Migración 0012:** `services.field_data` (jsonb — captura de terreno de OTs nuevas;
`legacy_data` queda como artefacto de importación) + **`next_cert_folio()`**: función SQL
que entrega el folio siguiente y avanza el contador EN UNA SENTENCIA (atómico, probado
con rollback contra producción: entrega 30.698 → siguiente 30.699).

**Qué se construyó:**

- **`/ordenes/[id]` — detalle/edición de OT (réplica v1):** datos generales (fecha
  bloqueada si terminada, técnico, tipo de visita con los 7 valores v1), metodología
  (default "M.I.P"), grado de infestación, insumos, áreas tratadas, plagas (chips del
  catálogo), productos usados (filas dinámicas desde el catálogo), trabajo realizado,
  observaciones/recomendaciones (van al certificado), instrucciones al técnico,
  firmante (nombre/RUT/correo) y vigencia (30/60/90/180/365). Transiciones de estado
  (en proceso → por validar), eliminar solo si planificada/asignada (regla v1).
- **"Cerrar OT y generar certificado"** (botón v1): valida técnico asignado → folio
  atómico → crea el certificado congelando los datos → OT terminada + completed_at →
  redirige a la vista del certificado. Si el insert falla, el folio queda saltado
  (preferible a duplicar).
- **`/terreno/[id]` — certificado imprimible (réplica plantilla v1 templates_v2):**
  encabezado con datos legales de `tenant_settings` (razón social, RUT, Res. Sanitaria,
  representante), folio destacado, identificación del inmueble, diagnóstico previo
  (plagas+grado), datos del servicio, barra de fechas (servicio/emisión/vigencia),
  chips de tratamientos, metodología/lugares, tabla de productos ENRIQUECIDA desde el
  catálogo (Reg. ISP, formulación, ingrediente activo, dosis), observaciones, firma del
  representante técnico (imagen heredada), leyenda penal exacta de la v1. Botón
  Imprimir/Guardar PDF con CSS de impresión (solo se imprime la hoja). Sirve para los
  386 importados y los nuevos.
- **Ficha de cliente enriquecida:** resumen operativo con contratos, próximas visitas,
  últimos certificados, últimos movimientos y layouts del cliente (las pestañas clave
  de la ficha v1 de 13 pestañas), todo enlazado a sus módulos.
- **Flujo de facturación:** `/comercial/[id]` detalle de movimiento con avance de
  estado en un clic (cotizado→aprobado→facturado→pagado, rechazar/reabrir), edición
  completa, DTE y OTs enlazadas visibles, eliminar con confirmación (cascade verificado).
  Filas de la lista enlazadas.

**Fix propio detectado en revisión:** guardar una OT terminada borraba la asignación
del técnico (el selector deshabilitado no se envía) — corregido conservando la
asignación histórica.

**Pendiente Fase 3 restante:** captura móvil en terreno (check-in/firma del cliente/fotos),
guardado del PDF en Storage + envío por correo, editor visual de layouts, QR de verificación.

## 2026-06-11 (5ª sesión) — Captura móvil en terreno (check-in, firma, fotos)

**Migración 0013:** bucket privado de Storage `terreno` (rutas `{tenant}/{service}/…`,
políticas RLS que exigen que la primera carpeta sea el tenant del usuario → aislamiento
por empresa también en archivos; límite 10 MB, solo imágenes). Fotos se muestran con
URLs firmadas (1 h), nunca públicas.

**Qué se construyó (flujo del técnico, móvil-first):**

- **`/terreno/hoy`:** visitas del día (hora, cliente, sucursal con dirección, estado).
  Si el usuario tiene rol `tecnico` y su ficha en `/tecnicos` está enlazada a su cuenta
  (technicians.profile_id), ve SOLO sus visitas asignadas.
- **`/terreno/hoy/[id]` — captura de la visita:**
  - **Check-in** con hora + GPS (geolocalización del teléfono, mejor esfuerzo) →
    la OT pasa a "en proceso". Enlace "Cómo llegar" (Google Maps).
  - Registro: trabajo realizado, plagas (chips), observaciones, recomendaciones.
  - **Fotos:** se comprimen EN el teléfono (máx 1600px JPEG 80% — velocidad con señal
    mala) y suben al bucket; rutas guardadas en `field_data.fotos`.
  - **Firma del cliente** en canvas táctil (`signature-pad.tsx`) → base64 en
    `field_data.firma_cliente_base64` + nombre/RUT de quien recibe.
  - **"Terminar visita"** (valida trabajo realizado + nombre firmante): check-out con
    hora/GPS → la OT queda **"por validar"**; la oficina la cierra y emite el
    certificado desde `/ordenes/[id]` (flujo v1: técnico→por_validar, admin→terminada).
- **`/ordenes/[id]` (admin):** nueva sección "Evidencias de terreno" — check-in/out con
  enlace al punto GPS, firma del cliente y galería de fotos (URLs firmadas).
- Acceso: botón "📱 Visitas de hoy" en Terreno.

**Pendiente Fase 3 restante:** PDF del certificado a Storage + envío por correo;
editor visual de layouts; QR de verificación pública; PWA offline.

## 2026-06-11 (6ª sesión) — PDF del certificado + correo al cliente + QR de verificación + enlace técnico↔cuenta

**Migración 0014** (aplicada y verificada: 386/386 certificados con código):
`certificates.verify_code` (uuid único, imposible de adivinar) + `sent_at`/`sent_to`;
bucket privado de Storage **`certificados`** (solo PDF, rutas `{tenant}/{cert}.pdf`,
mismas políticas por carpeta-tenant que `terreno`, + UPDATE para regenerar);
función **`verify_certificate(p_code)`** SECURITY DEFINER con acceso `anon`:
la página pública consulta UN certificado por su código y recibe SOLO campos
seguros (folio, cliente, fechas) — la RLS de la tabla no se abre.

**Qué se construyó:**

- **PDF del certificado en el servidor** (`src/lib/pdf/certificate-pdf.tsx`,
  @react-pdf/renderer): réplica de la hoja imprimible (encabezado legal, folio,
  secciones navy, tabla de productos enriquecida, firma del representante,
  leyenda penal) + **QR de verificación** en el pie. Probado contra datos
  reales de producción (`migration/test-pdf.mts` genera PDFs de muestra en
  `migration/exports/`). La vista de datos se unificó en
  `src/lib/cert-view.ts` (puro) + `src/lib/certificates.ts`
  (`getCertificateView`): la página imprimible y el PDF usan EXACTAMENTE el
  mismo armado de datos.
- **Generar y enviar desde `/terreno/[id]`:** sección "PDF y envío al cliente"
  (no se imprime): Generar/Regenerar PDF (queda en Storage, URL firmada 1 h
  para descargar), enviar por correo con el PDF adjunto (correo sugerido:
  firmante del servicio o contacto destinatario del cliente), registro del
  último envío. Si falla el correo NO se marca como enviado.
- **Correo vía Resend** (`src/lib/email.ts`, API HTTP directa, sin SDK):
  requiere `RESEND_API_KEY` + `EMAIL_FROM` en Vercel; sin ellas la app avisa
  "pendiente de configurar" y todo lo demás sigue funcionando. El remitente
  usa el dominio serfuplagas.cl (verificación DNS en Resend, guía a Carlos).
- **Verificación pública `/verificar/[code]`** (sin login, fuera del layout
  protegido): "Certificado auténtico" con folio/cliente/fechas, aviso ámbar si
  la vigencia expiró, rojo si el código no existe. El QR del PDF y de la hoja
  imprimible apuntan aquí. `NEXT_PUBLIC_SITE_URL` (o la URL de producción de
  Vercel) arma el enlace.
- **QR también en la hoja imprimible** de `/terreno/[id]` (pie, junto a la
  leyenda penal y la URL de verificación en texto).
- **`/tecnicos`: enlazar cuenta de la app** — selector por técnico con los
  perfiles de la empresa (`technicians.profile_id`, valida que el perfil sea
  del mismo tenant); con la cuenta enlazada el técnico ve SOLO sus visitas en
  `/terreno/hoy`. Ya no hay que tocar la base a mano.

**Además (pedido de Carlos en la misma sesión):**
- **Versión de la app visible** en la cabecera (junto a la marca, tenue, tooltip
  "Versión publicada"), como en la v1. Sale de `package.json` → **v2.0.0**;
  subir la versión en cada sesión que despliegue cambios.
- **Headers sticky:** clase `.modulo-sticky-top` en `globals.css` (réplica del
  patrón v1): el bloque título de CADA módulo queda fijo bajo la cabecera al
  hacer scroll (desktop: bajo los 56px; móvil: bajo cabecera + menú móvil, que
  ahora también es sticky con altura fija h-12). Aplicada a los 13 módulos
  principales (panel, agenda, clientes, mapa, órdenes, pendientes, comercial,
  terreno, terreno/hoy, stock, layouts, técnicos, configuración).

**Verificado:** typecheck/lint/build ✅ · PDFs reales revisados visualmente ✅ ·
migración 0014 aplicada en producción ✅. (La revisión adversarial multi-agente
no pudo correr: límite mensual de gasto de subagentes; se hizo revisión manual
de los puntos críticos.)

**Pendiente que depende de Carlos (guiado en el chat):** crear cuenta en
Resend, verificar el dominio serfuplagas.cl (DNS) y cargar `RESEND_API_KEY` +
`EMAIL_FROM` en Vercel.

**Pendiente Fase 3 restante:** editor visual de layouts/estaciones; PWA offline.

## 2026-06-11 (7ª sesión) — Correo vía Microsoft Graph (como v1) + certificado en formato v1 exacto

**Revisión de la v1 pedida por Carlos** (functions/correo.js, functions/pdf.js,
modulos/informes/templates_v2.js):

- **La v1 NO usa proveedor externo de correo: usa Microsoft Graph** (app de
  Azure con Mail.Send; secretos GRAPH_TENANT_ID/CLIENT_ID/CLIENT_SECRET/
  SENDER_EMAIL en el Secret Manager del proyecto Firebase; remitentes
  permitidos: operaciones@, facturacion@, contacto@, abernal@serfuplagas.cl).
  → `src/lib/email.ts` REESCRITO: token client_credentials + sendMail de Graph,
  con la MISMA plantilla HTML corporativa de la v1 (header SERFUPLAGAS, footer
  logo + www.serfuplagas.cl). Se descartó Resend. Falta que Carlos copie los 4
  secretos GRAPH_* a Vercel (la llave de servicio no tiene permiso de Secret
  Manager: 403; script listo en `migration/get-graph-secrets.mjs` si se le da
  el rol "Secret Manager Secret Accessor").
- **Formato v1 del certificado aplicado** a PDF y hoja imprimible: logo en el
  encabezado (embebido en `src/lib/pdf/logo.ts` + `public/logo-serfuplagas.png`),
  folio DENTRO de "Identificación del inmueble", "Persona que solicitó el
  trabajo", fechas Servicio/Inicio del tratamiento/Vigencia, tabla de productos
  con columna **Concentración** y sub-etiqueta por tratamiento (Desratización —
  Rodenticidas / Cebos…), observaciones por defecto de Configuración SIEMPRE
  primero, pie fijo al borde inferior con contacto + leyenda legal
  (`texto_legal_cert` configurable) + QR "Verificar documento", colores
  configurables (`pdf_color_primario`/`acento`). Vista ampliada en cert-view
  (tel, colores, obsDefault/recsDefault, textoLegal). PDF re-probado con datos
  reales: 1 página A4 ✅.
- **La v1 además tiene un REPORTE TÉCNICO** (documento aparte, multi-página:
  registro de visita, láminas UV con análisis IA, evidencia fotográfica,
  planos). El QR v1 verificaba por folio en app.serfuplagas.cl/verificar; la
  v2 verifica por código aleatorio (más seguro). **Pendiente próximo: portar
  el Reporte Técnico** (la v2 ya captura fotos de terreno, base lista).

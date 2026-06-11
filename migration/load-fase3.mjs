// =============================================================================
// Serfuplagapp v2 — Importación Fase 3 desde la v1 (Firestore → Postgres)
//   catálogos (productos/plagas/textos) · layouts · certificados ·
//   facturación (cobros→movements, facturas→dte_documents) · empresa_config.
//
// Uso:
//   node migration/load-fase3.mjs            → SOLO vista previa (CSV + resumen)
//   node migration/load-fase3.mjs --load     → además CARGA (transacción única)
//
// Idempotente: lo ya cargado (legacy_id existente) se omite. No toca la v1.
// =============================================================================
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import pg from "pg";

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, "$1"));
const RAW = path.join(HERE, "exports", "2026-06-11", "raw");
const PREVIEW = path.join(HERE, "exports", "2026-06-11", "preview");
mkdirSync(PREVIEW, { recursive: true });
const DO_LOAD = process.argv.includes("--load");

const load = (n) => JSON.parse(readFileSync(path.join(RAW, `${n}.json`), "utf8"));
const productos = load("productos");
const plagas = load("plagas");
const textos = load("textos_predefinidos");
const layoutsRaw = load("layouts");
const certificados = load("certificados");
const cobros = load("cobros");
const facturas = load("facturas");
const empresaConfig = load("empresa_config");

const cs = readFileSync("C:\\Users\\carlo\\serfuplagapp-v2\\Secretos\\db.txt", "utf8").trim();
const db = new pg.Client({ connectionString: cs, ssl: { rejectUnauthorized: false } });
await db.connect();

// ── Lookups de la v2 ─────────────────────────────────────────────────────────
const { rows: tRows } = await db.query("select id from public.tenants where name = 'Serfuplagas Ltda.' limit 1");
const TENANT = tRows[0]?.id;
if (!TENANT) throw new Error("No se encontró el tenant Serfuplagas Ltda.");

const { rows: cls } = await db.query("select id, legacy_id, rut, name from public.clients");
const clientByLegacy = new Map(cls.filter((c) => c.legacy_id).map((c) => [c.legacy_id, c]));
const rutNorm = (r) => (r ?? "").replace(/[.\s]/g, "").toLowerCase();
const clientByRut = new Map(cls.filter((c) => c.rut).map((c) => [rutNorm(c.rut), c]));

const { rows: brs } = await db.query("select id, legacy_id, client_id, name from public.branches");
const branchByLegacy = new Map(brs.filter((b) => b.legacy_id).map((b) => [b.legacy_id, b]));
const normName = (s) => (s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();

const { rows: svcs } = await db.query("select id, legacy_id, client_id, branch_id from public.services where legacy_id is not null");
const serviceByLegacy = new Map(svcs.map((s) => [s.legacy_id, s]));

// Ya importados (idempotencia).
const existing = {};
for (const [table, col] of [["products", "legacy_id"], ["pests", "legacy_id"], ["predefined_texts", "legacy_id"], ["layouts", "legacy_id"], ["certificates", "legacy_id"], ["movements", "legacy_id"], ["dte_documents", "legacy_id"]]) {
  const { rows } = await db.query(`select ${col} from public.${table} where ${col} is not null`);
  existing[table] = new Set(rows.map((r) => r[col]));
}

// Resuelve cliente/sucursal desde un id v1 que puede ser cliente o sucursal.
function resolveClientBranch(v1Id, rut) {
  if (v1Id && clientByLegacy.has(v1Id)) return { client_id: clientByLegacy.get(v1Id).id, branch_id: null };
  if (v1Id && branchByLegacy.has(v1Id)) {
    const b = branchByLegacy.get(v1Id);
    return { client_id: b.client_id, branch_id: b.id };
  }
  if (rut && clientByRut.has(rutNorm(rut))) return { client_id: clientByRut.get(rutNorm(rut)).id, branch_id: null };
  return { client_id: null, branch_id: null };
}

// ── Transformaciones ─────────────────────────────────────────────────────────
const out = { products: [], pests: [], predefined_texts: [], layouts: [], certificates: [], movements: [], movement_services: [], dte_documents: [] };
const issues = [];

// productos
for (const p of productos) {
  if (existing.products.has(p._id)) continue;
  out.products.push({
    tenant_id: TENANT, name: p.nombre ?? "(sin nombre)", active: p.activo !== false,
    favorito: p.favorito === true, dosis: p.dosis ?? null, formulacion: p.formulacion ?? null,
    concentracion: p.concentracion ?? null, ingrediente_activo: p.ingrediente_activo ?? null,
    isp: p.isp ?? null, laboratorio: p.laboratorio ?? null, unidad: p.unidad ?? null,
    service_names: Array.isArray(p.servicios) ? p.servicios.filter((x) => typeof x === "string") : null,
    legacy_id: p._id,
  });
}

// plagas
for (const p of plagas) {
  if (existing.pests.has(p._id)) continue;
  out.pests.push({
    tenant_id: TENANT, name: p.nombre ?? "(sin nombre)", scientific_name: p.nombre_cientifico ?? null,
    active: p.activo !== false, legacy_id: p._id,
  });
}

// textos predefinidos
const KINDS = new Set(["trabajo", "observacion", "recomendacion"]);
for (const t of textos) {
  if (existing.predefined_texts.has(t._id)) continue;
  if (!KINDS.has(t.tipo)) { issues.push(`texto ${t._id}: tipo desconocido "${t.tipo}" — omitido`); continue; }
  out.predefined_texts.push({
    tenant_id: TENANT, kind: t.tipo, body: t.texto ?? "", sort_order: Number(t.orden) || 0,
    active: t.activo !== false, legacy_id: t._id,
  });
}

// layouts (cliente_id de la v1 suele ser una SUCURSAL v2)
for (const l of layoutsRaw) {
  if (existing.layouts.has(l._id)) continue;
  let { client_id, branch_id } = resolveClientBranch(l.cliente_id, null);
  if (!client_id && l.cliente_nombre) {
    // último recurso: calce por nombre de sucursal
    const target = normName(l.cliente_nombre);
    const b = brs.find((x) => normName(x.name).includes(target) || target.includes(normName(x.name).slice(0, 30)));
    if (b) { client_id = b.client_id; branch_id = b.id; }
    else issues.push(`layout "${l.nombre}": sin cliente/sucursal enlazable (${l.cliente_nombre ?? "sin nombre"})`);
  }
  out.layouts.push({
    tenant_id: TENANT, name: l.nombre ?? "(sin nombre)", client_id, branch_id,
    bg_color: typeof l.bg_color === "string" ? l.bg_color : null,
    bg_image: typeof l.bg_image === "string" ? l.bg_image : null,
    header: l.header ?? null, elements: Array.isArray(l.elementos) ? l.elementos : [],
    thumbnail: typeof l.thumbnail === "string" ? l.thumbnail : null,
    snapshot_url: typeof l.snapshot_url === "string" ? l.snapshot_url : null,
    snapshot_w: Number(l.snapshot_w) || null, snapshot_h: Number(l.snapshot_h) || null,
    legacy_id: l._id,
  });
}

// certificados
for (const c of certificados) {
  if (existing.certificates.has(c._id)) continue;
  const folio = Number(c.folio);
  if (!Number.isFinite(folio)) { issues.push(`certificado ${c._id}: folio inválido "${c.folio}" — omitido`); continue; }
  const svc = c.ot_id ? serviceByLegacy.get(c.ot_id) : null;
  let client_id = svc?.client_id ?? null;
  let branch_id = svc?.branch_id ?? null;
  if (!client_id) ({ client_id, branch_id } = resolveClientBranch(c.cliente_id, c.cliente_rut));
  if (!client_id) issues.push(`certificado folio ${folio}: sin cliente enlazable (${c.cliente_nombre ?? "?"})`);
  const { _id, ot_id, cliente_id, folio: _f, fecha_emision, fecha_servicio, creado_en, empresa_id, ...resto } = c;
  out.certificates.push({
    tenant_id: TENANT, folio, service_id: svc?.id ?? null, client_id, branch_id,
    issued_at: fecha_emision ?? creado_en ?? null, service_date: fecha_servicio ?? null,
    data: resto, legacy_id: _id,
  });
}

// cobros → movements (+movement_services por ot_ids)
const STATUS_MAP = { borrador: "aprobado", aprobado: "aprobado", facturado: "facturado", pagado: "pagado", anulado: "rechazado" };
for (const c of cobros) {
  if (existing.movements.has(c._id)) continue;
  let { client_id } = resolveClientBranch(c.cliente_id, c.cliente_rut);
  if (!client_id) {
    const firstOt = (c.ot_ids ?? []).map((id) => serviceByLegacy.get(id)).find(Boolean);
    client_id = firstOt?.client_id ?? null;
  }
  if (!client_id) issues.push(`cobro ${c._id} (${c.cliente_nombre ?? "?"}): sin cliente — queda con client_name_raw`);
  const date = (c.fecha_creacion ?? "").slice(0, 10) || `${c.periodo ?? "2026-05"}-01`;
  const status = STATUS_MAP[c.estado] ?? "aprobado";
  if (!STATUS_MAP[c.estado]) issues.push(`cobro ${c._id}: estado desconocido "${c.estado}" → aprobado`);
  out.movements.push({
    tenant_id: TENANT, client_id, date, type: "venta",
    amount: Math.round(Number(c.monto_total) || 0), status,
    description: [c.periodo ? `Periodo ${c.periodo}` : null, c.notas || null].filter(Boolean).join(" · ") || null,
    client_name_raw: c.cliente_nombre ?? null,
    dte_folio: c.folio_sii != null ? String(c.folio_sii) : null,
    oc_number: c.numero_oc || null,
    legacy_id: c._id,
  });
  for (const otId of c.ot_ids ?? []) {
    const svc = serviceByLegacy.get(otId);
    if (svc) out.movement_services.push({ tenant_id: TENANT, movement_legacy: c._id, service_id: svc.id });
    else issues.push(`cobro ${c._id}: OT ${otId} no existe en la v2 — enlace omitido`);
  }
}

// facturas → dte_documents (enlazadas al movimiento del cobro)
for (const f of facturas) {
  if (existing.dte_documents.has(f._id)) continue;
  out.dte_documents.push({
    tenant_id: TENANT, movement_legacy: f.cobro_id ?? null,
    sii_type: Number(f.tipo_dte) || null,
    folio: f.folio_sii != null && typeof f.folio_sii !== "object" ? String(f.folio_sii) : null,
    status: f.estado_sii ?? null,
    pdf_path: typeof f.pdf_url === "string" ? f.pdf_url : null,
    xml_path: typeof f.xml_url === "string" ? f.xml_url : null,
    legacy_id: f._id,
  });
}

// empresa_config → tenant_settings (upsert)
const cfg = empresaConfig[0] ?? {};
const settings = {
  cert_next_folio: Number(cfg.folio_actual) || 30698,
  quote_next_folio: Number(cfg.cot_folio_actual) || 1,
  data: {
    rep_legal: cfg.rep_legal ?? null, rep_tec: cfg.rep_tec ?? null, res_san: cfg.res_san ?? null,
    direccion: cfg.direccion ?? null, correo: cfg.correo ?? null,
    color_principal: cfg.color_principal ?? null,
    pdf_color_primario: cfg.pdf_color_primario ?? null, pdf_color_acento: cfg.pdf_color_acento ?? null,
    firma_tec_url: cfg.firma_tec_url ?? null, firma_tec_base64: cfg.firma_tec_base64 ?? null,
    observaciones_default: cfg.observaciones_default ?? null,
    recomendaciones_default: cfg.recomendaciones_default ?? null,
    rep_trabajo_default: cfg.rep_trabajo_default ?? null,
    rep_obs_default: cfg.rep_obs_default ?? null, rep_recs_default: cfg.rep_recs_default ?? null,
    folio_inicial: cfg.folio_inicial ?? null, cot_folio_inicial: cfg.cot_folio_inicial ?? null,
    nombre_legal: cfg.nombre ?? null, rut: cfg.rut ?? null,
  },
};

// ── Vista previa ─────────────────────────────────────────────────────────────
const csv = (rows, cols) =>
  [cols.join(";"), ...rows.map((r) => cols.map((c) => String(r[c] ?? "").replace(/[\r\n;]+/g, " ").slice(0, 120)).join(";"))].join("\n");
writeFileSync(path.join(PREVIEW, "certificates.csv"), csv(out.certificates.map((c) => ({ folio: c.folio, emitido: (c.issued_at ?? "").slice(0, 10), cliente: c.data.cliente_nombre, con_ot: c.service_id ? "sí" : "no" })), ["folio", "emitido", "cliente", "con_ot"]), "utf8");
writeFileSync(path.join(PREVIEW, "movements.csv"), csv(out.movements.map((m) => ({ fecha: m.date, cliente: m.client_name_raw, monto: m.amount, estado: m.status, enlazado: m.client_id ? "sí" : "no" })), ["fecha", "cliente", "monto", "estado", "enlazado"]), "utf8");
writeFileSync(path.join(PREVIEW, "layouts.csv"), csv(out.layouts.map((l) => ({ nombre: l.name, sucursal: l.branch_id ? "sí" : "NO", elementos: l.elements.length })), ["nombre", "sucursal", "elementos"]), "utf8");

console.log("— RESUMEN DE LA TRANSFORMACIÓN —");
console.log(`productos:        ${out.products.length} nuevos (de ${productos.length})`);
console.log(`plagas:           ${out.pests.length} nuevas (de ${plagas.length})`);
console.log(`textos:           ${out.predefined_texts.length} nuevos (de ${textos.length})`);
console.log(`layouts:          ${out.layouts.length} nuevos (de ${layoutsRaw.length}) · sin sucursal: ${out.layouts.filter((l) => !l.branch_id).length}`);
console.log(`certificados:     ${out.certificates.length} nuevos (de ${certificados.length}) · con OT: ${out.certificates.filter((c) => c.service_id).length} · sin cliente: ${out.certificates.filter((c) => !c.client_id).length}`);
console.log(`movements:        ${out.movements.length} nuevos (de ${cobros.length}) · suma: $${out.movements.reduce((a, m) => a + m.amount, 0).toLocaleString("es-CL")}`);
console.log(`movement_services:${out.movement_services.length} enlaces`);
console.log(`dte_documents:    ${out.dte_documents.length} nuevos (de ${facturas.length})`);
console.log(`tenant_settings:  cert_next_folio=${settings.cert_next_folio} · quote_next_folio=${settings.quote_next_folio}`);
if (issues.length) {
  console.log(`\n— AVISOS (${issues.length}) —`);
  for (const i of issues.slice(0, 25)) console.log("  · " + i);
  if (issues.length > 25) console.log(`  … y ${issues.length - 25} más`);
}
console.log(`\nVistas previas CSV → migration/exports/2026-06-11/preview/`);

if (!DO_LOAD) {
  console.log("\n(Solo vista previa. Para cargar: node migration/load-fase3.mjs --load)");
  await db.end();
  process.exit(0);
}

// ── Carga transaccional ──────────────────────────────────────────────────────
console.log("\n— CARGANDO (transacción única) —");
await db.query("begin");
try {
  const insert = async (table, rows, cols) => {
    for (const r of rows) {
      const vals = cols.map((c) => {
        const v = r[c];
        return v !== null && typeof v === "object" && !Array.isArray(v) ? JSON.stringify(v) : Array.isArray(v) && (c === "elements" || c === "header" || c === "data") ? JSON.stringify(v) : v;
      });
      await db.query(
        `insert into public.${table} (${cols.join(",")}) values (${cols.map((_, i) => `$${i + 1}`).join(",")})`,
        vals,
      );
    }
    console.log(`  ✅ ${table}: ${rows.length}`);
  };

  await insert("products", out.products, ["tenant_id", "name", "active", "favorito", "dosis", "formulacion", "concentracion", "ingrediente_activo", "isp", "laboratorio", "unidad", "service_names", "legacy_id"]);
  await insert("pests", out.pests, ["tenant_id", "name", "scientific_name", "active", "legacy_id"]);
  await insert("predefined_texts", out.predefined_texts, ["tenant_id", "kind", "body", "sort_order", "active", "legacy_id"]);
  await insert("layouts", out.layouts, ["tenant_id", "name", "client_id", "branch_id", "bg_color", "bg_image", "header", "elements", "thumbnail", "snapshot_url", "snapshot_w", "snapshot_h", "legacy_id"]);
  await insert("certificates", out.certificates, ["tenant_id", "folio", "service_id", "client_id", "branch_id", "issued_at", "service_date", "data", "legacy_id"]);
  await insert("movements", out.movements, ["tenant_id", "client_id", "date", "type", "amount", "status", "description", "client_name_raw", "dte_folio", "oc_number", "legacy_id"]);

  // movement_services: resolver el movement_id por legacy.
  const { rows: movRows } = await db.query("select id, legacy_id from public.movements where legacy_id is not null");
  const movByLegacy = new Map(movRows.map((m) => [m.legacy_id, m.id]));
  let msCount = 0;
  for (const ms of out.movement_services) {
    const movement_id = movByLegacy.get(ms.movement_legacy);
    if (!movement_id) continue;
    await db.query(
      "insert into public.movement_services (tenant_id, movement_id, service_id) values ($1,$2,$3) on conflict do nothing",
      [ms.tenant_id, movement_id, ms.service_id],
    );
    msCount++;
  }
  console.log(`  ✅ movement_services: ${msCount}`);

  let dteCount = 0;
  for (const d of out.dte_documents) {
    const movement_id = movByLegacy.get(d.movement_legacy);
    if (!movement_id) { console.log(`  ⚠ factura ${d.legacy_id}: cobro ${d.movement_legacy} no encontrado — omitida`); continue; }
    await db.query(
      "insert into public.dte_documents (tenant_id, movement_id, sii_type, folio, status, pdf_path, xml_path, legacy_id) values ($1,$2,$3,$4,$5,$6,$7,$8)",
      [d.tenant_id, movement_id, d.sii_type, d.folio, d.status, d.pdf_path, d.xml_path, d.legacy_id],
    );
    dteCount++;
  }
  console.log(`  ✅ dte_documents: ${dteCount}`);

  await db.query(
    `insert into public.tenant_settings (tenant_id, cert_next_folio, quote_next_folio, data)
     values ($1,$2,$3,$4)
     on conflict (tenant_id) do update set cert_next_folio = excluded.cert_next_folio,
       quote_next_folio = excluded.quote_next_folio, data = excluded.data`,
    [TENANT, settings.cert_next_folio, settings.quote_next_folio, JSON.stringify(settings.data)],
  );
  console.log("  ✅ tenant_settings: 1 (upsert)");

  await db.query("commit");
  console.log("\n✅ CARGA COMPLETA (commit).");
} catch (e) {
  await db.query("rollback");
  console.error("\n❌ ERROR — ROLLBACK total, no se cargó nada:", e.message);
  process.exitCode = 1;
}
await db.end();

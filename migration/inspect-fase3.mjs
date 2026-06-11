// Inspección local de los datos exportados (no toca Firestore ni Postgres).
// Uso: node migration/inspect-fase3.mjs
import { readFileSync } from "node:fs";
import path from "node:path";
import pg from "pg";

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, "$1"));
const RAW = path.join(HERE, "exports", "2026-06-11", "raw");
const load = (n) => JSON.parse(readFileSync(path.join(RAW, `${n}.json`), "utf8"));

const cobros = load("cobros");
const certificados = load("certificados");
const layouts = load("layouts");
const facturas = load("facturas");
const pagos = load("pagos");
const productos = load("productos");
const textos = load("textos_predefinidos");
const config = load("empresa_config");

// ── cobros ──
console.log("— COBROS —");
const estados = {};
for (const c of cobros) estados[c.estado ?? "(null)"] = (estados[c.estado ?? "(null)"] ?? 0) + 1;
console.log("estados:", estados);
const periodos = {};
for (const c of cobros) periodos[c.periodo ?? "(null)"] = (periodos[c.periodo ?? "(null)"] ?? 0) + 1;
console.log("periodos:", periodos);
console.log("con ot_ids>0:", cobros.filter((c) => (c.ot_ids ?? []).length > 0).length);
console.log("con factura_id string:", cobros.filter((c) => typeof c.factura_id === "string" && c.factura_id).length);
console.log("ids raros:", cobros.filter((c) => !c.cliente_id).map((c) => c._id));
console.log("tipo_documento:", [...new Set(cobros.map((c) => c.tipo_documento))]);
console.log("suma monto_total:", cobros.reduce((a, c) => a + (c.monto_total ?? 0), 0));
console.log("muestra linea:", JSON.stringify(cobros.find((c) => (c.lineas ?? []).length > 0)?.lineas?.[0])?.slice(0, 300));

// ── certificados ──
console.log("\n— CERTIFICADOS —");
const folioTypes = {};
for (const c of certificados) folioTypes[typeof c.folio] = (folioTypes[typeof c.folio] ?? 0) + 1;
console.log("tipos de folio:", folioTypes);
const folios = certificados.map((c) => Number(c.folio)).filter((n) => Number.isFinite(n));
console.log("folio min/max:", Math.min(...folios), Math.max(...folios), "· únicos:", new Set(folios).size, "de", folios.length);
console.log("con ot_id:", certificados.filter((c) => typeof c.ot_id === "string" && c.ot_id).length);
console.log("unidad_id tipos:", [...new Set(certificados.map((c) => typeof c.unidad_id))]);
console.log("campos fecha: emision", certificados.filter((c) => c.fecha_emision).length, "servicio", certificados.filter((c) => c.fecha_servicio).length);
console.log("muestra producto en cert:", JSON.stringify(certificados.find((c) => (c.productos ?? []).length > 0)?.productos?.[0])?.slice(0, 250));
console.log("muestra servicios:", JSON.stringify(certificados.find((c) => (c.servicios ?? []).length > 0)?.servicios)?.slice(0, 200));

// ── layouts ──
console.log("\n— LAYOUTS —");
for (const l of layouts) {
  const thumbKb = l.thumbnail ? Math.round(l.thumbnail.length / 1024) : 0;
  const bgKb = typeof l.bg_image === "string" ? Math.round(l.bg_image.length / 1024) : 0;
  console.log(
    `  ${(l.nombre ?? "(sin nombre)").slice(0, 35).padEnd(35)} cliente=${(l.cliente_nombre ?? "?").slice(0, 22).padEnd(22)} elementos=${String((l.elementos ?? []).length).padStart(3)} thumb=${thumbKb}KB bg=${bgKb}KB snapshot=${l.snapshot_url ? "sí" : "no"}`,
  );
}
const el = layouts.find((l) => (l.elementos ?? []).length > 0)?.elementos?.[0];
console.log("muestra elemento:", JSON.stringify(el)?.slice(0, 350));

// ── facturas / pagos ──
console.log("\n— FACTURAS —");
for (const f of facturas)
  console.log(`  folio_sii=${f.folio_sii} estado_sii=${f.estado_sii} estado_pago=${f.estado_pago} cobro=${(f.cobro_id ?? "").slice(0, 8)} tipo=${f.tipo_dte} total=${f.monto_total}`);
console.log("— PAGOS —");
for (const p of pagos) console.log(`  cobro=${(p.cobro_id ?? "").slice(0, 8)} monto=${p.monto} metodo=${p.metodo} fecha=${p.fecha_pago}`);

// ── productos / textos ──
console.log("\n— PRODUCTOS — muestra servicios[]:", JSON.stringify(productos.find((p) => (p.servicios ?? []).length)?.servicios));
console.log("— TEXTOS — campos:", Object.keys(textos[0] ?? {}).join(", "));
console.log("  tipos:", [...new Set(textos.map((t) => t.tipo ?? t.categoria ?? "?"))]);

// ── empresa_config ──
console.log("\n— EMPRESA_CONFIG (campos de folio y legales) —");
const cfg = config[0] ?? {};
for (const k of ["folio_actual", "folio_inicial", "folio_prefijo", "cot_folio_actual", "cot_folio_inicial", "cot_folio_prefijo", "rep_legal", "rep_tec", "res_san", "nombre", "rut", "direccion", "correo", "color_principal", "pdf_color_primario", "pdf_color_acento"])
  console.log(`  ${k}:`, JSON.stringify(cfg[k])?.slice(0, 90));
console.log("  firma_tec_url:", cfg.firma_tec_url ? "sí" : "no", "· firma_tec_base64:", cfg.firma_tec_base64 ? `${Math.round((cfg.firma_tec_base64.length || 0) / 1024)}KB` : "no");

// ── cruces contra la base v2 (solo lectura) ──
const cs = readFileSync("C:\\Users\\carlo\\serfuplagapp-v2\\Secretos\\db.txt", "utf8").trim();
const db = new pg.Client({ connectionString: cs, ssl: { rejectUnauthorized: false } });
await db.connect();
const { rows: svcLegacy } = await db.query("select legacy_id from public.services where legacy_id is not null");
const svcSet = new Set(svcLegacy.map((r) => r.legacy_id));
const { rows: cliLegacy } = await db.query("select legacy_id from public.clients where legacy_id is not null");
const cliSet = new Set(cliLegacy.map((r) => r.legacy_id));
const { rows: movCount } = await db.query("select count(*) n from public.movements");
const { rows: maxFolioDb } = await db.query("select max((legacy_data->>'folio')::int) f from public.services where legacy_data->>'folio' ~ '^[0-9]+$'");
await db.end();

console.log("\n— CRUCES contra la v2 —");
console.log("certificados con ot_id que EXISTE en services.legacy_id:", certificados.filter((c) => svcSet.has(c.ot_id)).length, "de", certificados.length);
console.log("cobros con cliente_id que existe en clients.legacy_id:", cobros.filter((c) => cliSet.has(c.cliente_id)).length, "de", cobros.length);
console.log("layouts con cliente_id que existe:", layouts.filter((l) => cliSet.has(l.cliente_id)).length, "de", layouts.length);
const otIdsEnCobros = cobros.flatMap((c) => c.ot_ids ?? []);
console.log("ot_ids referidos por cobros que existen en services:", otIdsEnCobros.filter((id) => svcSet.has(id)).length, "de", otIdsEnCobros.length);
console.log("movements actuales en la v2 (registrados a mano):", movCount[0].n);
console.log("folio máx en services.legacy_data (v2):", maxFolioDb[0].f);
console.log("\n✅ Inspección lista.");
process.exit(0);

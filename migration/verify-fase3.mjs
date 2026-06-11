// Verificación de la importación Fase 3 (solo lectura).
// Uso: node migration/verify-fase3.mjs
import { readFileSync } from "node:fs";
import path from "node:path";
import pg from "pg";

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, "$1"));
const RAW = path.join(HERE, "exports", "2026-06-11", "raw");
const load = (n) => JSON.parse(readFileSync(path.join(RAW, `${n}.json`), "utf8"));
const cobros = load("cobros");
const certificados = load("certificados");

const cs = readFileSync("C:\\Users\\carlo\\serfuplagapp-v2\\Secretos\\db.txt", "utf8").trim();
const db = new pg.Client({ connectionString: cs, ssl: { rejectUnauthorized: false } });
await db.connect();
const q = async (l, sql) => { const r = await db.query(sql); console.log(`\n— ${l} —`); console.table(r.rows); };

await q("Conteos por tabla", `
  select 'products' t, count(*) n from public.products
  union all select 'pests', count(*) from public.pests
  union all select 'predefined_texts', count(*) from public.predefined_texts
  union all select 'layouts', count(*) from public.layouts
  union all select 'certificates', count(*) from public.certificates
  union all select 'movements', count(*) from public.movements
  union all select 'movement_services', count(*) from public.movement_services
  union all select 'dte_documents', count(*) from public.dte_documents
  union all select 'tenant_settings', count(*) from public.tenant_settings`);

await q("Certificados: enlaces y folios", `
  select count(*) total,
         count(service_id) con_ot,
         count(client_id) con_cliente,
         min(folio) folio_min, max(folio) folio_max,
         count(distinct folio) folios_unicos
  from public.certificates`);

await q("Folio siguiente configurado", `
  select cert_next_folio, quote_next_folio from public.tenant_settings`);

// Cuadre de montos por mes: v1 vs v2.
const v1PorMes = {};
for (const c of cobros) {
  const mes = c.periodo ?? "(sin)";
  v1PorMes[mes] = (v1PorMes[mes] ?? 0) + (Number(c.monto_total) || 0);
}
console.log("\n— Cuadre cobros v1 por periodo —");
console.table(Object.entries(v1PorMes).map(([mes, total]) => ({ mes, total_v1: total })));

await q("Movements v2 importados (por estado)", `
  select status, count(*) n, sum(amount)::bigint suma
  from public.movements where legacy_id is not null group by status order by n desc`);

await q("Movements v2: suma total importada", `
  select count(*) n, sum(amount)::bigint suma_total
  from public.movements where legacy_id is not null`);

await q("Layouts: enlace a sucursal", `
  select count(*) total, count(branch_id) con_sucursal, count(client_id) con_cliente,
         sum(jsonb_array_length(elements))::int total_elementos
  from public.layouts`);

await q("DTE importados", `
  select d.sii_type, d.folio, d.status, m.client_name_raw cliente
  from public.dte_documents d join public.movements m on m.id = d.movement_id
  where d.legacy_id is not null order by d.sii_type, d.folio`);

// Folios duplicados (re-emisiones v1, esperado ~6).
await q("Certificados con folio repetido (re-emisiones v1)", `
  select folio, count(*) n from public.certificates
  group by folio having count(*) > 1 order by folio`);

// Cuadre certificados: v1 386 docs.
console.log(`\nCertificados v1 en export: ${certificados.length}`);

await db.end();
console.log("\n✅ Verificación lista.");
process.exit(0);
